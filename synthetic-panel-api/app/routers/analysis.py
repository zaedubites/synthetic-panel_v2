"""
Analysis API Router

Endpoints for panel analysis and insights generation.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, TokenPayload
from app.models.panel import Panel
from app.models.panel_analysis import PanelAnalysis
from app.services.panel_conversation_engine import PanelConversationEngine
from app.services.ai_service import AIService

router = APIRouter(prefix="/analysis", tags=["analysis"])


class GenerateAnalysisRequest(BaseModel):
    """Request to generate panel analysis."""
    focus_areas: Optional[list[str]] = None
    include_quotes: bool = True
    include_recommendations: bool = True


@router.post("/panels/{panel_id}/generate")
async def generate_panel_analysis(
    panel_id: UUID,
    request: GenerateAnalysisRequest = GenerateAnalysisRequest(),
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate AI analysis for a completed panel session.

    Analyzes the conversation and produces insights, themes, and recommendations.
    """
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Organization context required")

    org_id = UUID(current_user.organization_id)

    # Verify panel exists and belongs to organization
    result = await db.execute(
        select(Panel).where(
            Panel.id == panel_id,
            Panel.organization_id == org_id
        )
    )
    panel = result.scalar_one_or_none()

    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")

    # Generate summary using conversation engine
    engine = PanelConversationEngine(db, org_id)
    summary = await engine.generate_panel_summary(panel_id)

    # Generate detailed analysis
    ai_service = AIService()

    focus_instruction = ""
    if request.focus_areas:
        focus_instruction = f"Focus particularly on: {', '.join(request.focus_areas)}"

    analysis_prompt = f"""Based on this panel session summary, provide a detailed analysis:

{summary}

{focus_instruction}

Please structure your analysis as follows:

1. **Executive Summary** (2-3 sentences)

2. **Key Themes** (list 3-5 major themes with brief explanations)

3. **Insights by Topic** (organize findings by topic area)

4. **Areas of Consensus** (what participants agreed on)

5. **Areas of Disagreement** (where opinions differed)

{"6. **Notable Quotes** (include 3-5 impactful direct quotes)" if request.include_quotes else ""}

{"7. **Recommendations** (actionable next steps based on findings)" if request.include_recommendations else ""}

8. **Suggested Follow-up Questions** (for future research)
"""

    analysis = await ai_service.generate_completion(
        system_prompt="You are an expert qualitative research analyst specializing in focus group analysis.",
        user_prompt=analysis_prompt,
        max_tokens=2500
    )

    # Generate themes as structured data
    themes = await ai_service.generate_completion(
        system_prompt="You are a data extraction assistant. Output valid JSON only.",
        user_prompt=f"""Extract the main themes from this analysis as a JSON array:

{analysis}

Format: [{{"theme": "Theme Name", "description": "Brief description", "sentiment": "positive/negative/neutral/mixed"}}]

Output only the JSON array, no other text.""",
        max_tokens=500
    )

    # Parse themes JSON
    import json
    try:
        themes_data = json.loads(themes)
    except json.JSONDecodeError:
        themes_data = []

    # Save analysis to database
    panel_analysis = PanelAnalysis(
        panel_id=panel_id,
        organization_id=org_id,
        summary=summary,
        themes=themes_data,
        key_findings={"analysis": analysis},
        recommendations=[] if not request.include_recommendations else None,
        generated_by="ai"
    )

    db.add(panel_analysis)
    await db.commit()
    await db.refresh(panel_analysis)

    return {
        "id": str(panel_analysis.id),
        "panel_id": str(panel_id),
        "summary": summary,
        "analysis": analysis,
        "themes": themes_data,
        "created_at": panel_analysis.created_at.isoformat() if panel_analysis.created_at else None
    }


@router.get("/panels/{panel_id}")
async def get_panel_analysis(
    panel_id: UUID,
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get existing analysis for a panel.
    """
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Organization context required")

    org_id = UUID(current_user.organization_id)

    result = await db.execute(
        select(PanelAnalysis).where(
            PanelAnalysis.panel_id == panel_id,
            PanelAnalysis.organization_id == org_id
        ).order_by(PanelAnalysis.created_at.desc())
    )
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return {
        "id": str(analysis.id),
        "panel_id": str(analysis.panel_id),
        "summary": analysis.summary,
        "themes": analysis.themes,
        "key_findings": analysis.key_findings,
        "recommendations": analysis.recommendations,
        "sentiment_analysis": analysis.sentiment_analysis,
        "created_at": analysis.created_at.isoformat() if analysis.created_at else None
    }


@router.post("/panels/{panel_id}/followup-questions")
async def generate_followup_questions(
    panel_id: UUID,
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate suggested follow-up questions based on panel discussion.
    """
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Organization context required")

    org_id = UUID(current_user.organization_id)

    # Get panel
    result = await db.execute(
        select(Panel).where(
            Panel.id == panel_id,
            Panel.organization_id == org_id
        )
    )
    panel = result.scalar_one_or_none()

    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")

    # Generate summary first
    engine = PanelConversationEngine(db, org_id)
    summary = await engine.generate_panel_summary(panel_id)

    # Generate follow-up questions
    ai_service = AIService()
    questions = await ai_service.generate_followup_questions(
        conversation_summary=summary,
        research_goal=panel.research_goal,
        num_questions=5
    )

    return {"questions": questions}


@router.post("/panels/{panel_id}/export")
async def export_panel_analysis(
    panel_id: UUID,
    format: str = "json",
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Export panel analysis in various formats.

    Supported formats: json, markdown
    """
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Organization context required")

    org_id = UUID(current_user.organization_id)

    # Get analysis
    result = await db.execute(
        select(PanelAnalysis).where(
            PanelAnalysis.panel_id == panel_id,
            PanelAnalysis.organization_id == org_id
        ).order_by(PanelAnalysis.created_at.desc())
    )
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Get panel details
    panel_result = await db.execute(
        select(Panel).where(Panel.id == panel_id)
    )
    panel = panel_result.scalar_one_or_none()

    if format == "markdown":
        # Generate markdown export
        md_content = f"""# Panel Analysis Report

## {panel.name if panel else 'Panel'}

**Generated:** {analysis.created_at.strftime('%Y-%m-%d %H:%M') if analysis.created_at else 'N/A'}

---

## Summary

{analysis.summary}

---

## Key Themes

"""
        if analysis.themes:
            for theme in analysis.themes:
                sentiment = theme.get('sentiment', 'neutral')
                md_content += f"### {theme.get('theme', 'Theme')}\n"
                md_content += f"*Sentiment: {sentiment}*\n\n"
                md_content += f"{theme.get('description', '')}\n\n"

        if analysis.key_findings:
            md_content += "\n---\n\n## Detailed Analysis\n\n"
            md_content += analysis.key_findings.get('analysis', '')

        return {
            "format": "markdown",
            "content": md_content,
            "filename": f"panel-analysis-{panel_id}.md"
        }

    # Default: JSON
    return {
        "format": "json",
        "content": {
            "panel_id": str(panel_id),
            "panel_name": panel.name if panel else None,
            "summary": analysis.summary,
            "themes": analysis.themes,
            "key_findings": analysis.key_findings,
            "recommendations": analysis.recommendations,
            "created_at": analysis.created_at.isoformat() if analysis.created_at else None
        },
        "filename": f"panel-analysis-{panel_id}.json"
    }
