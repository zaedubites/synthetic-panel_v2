"""
Knowledge Service - Platform Integration

Integrates with the existing EduBites platform knowledge system
to provide context for persona responses.
"""

import httpx
from typing import Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings


class KnowledgeService:
    """
    Service for accessing knowledge from the platform's knowledge groups.

    This service reads from the platform schema to leverage existing
    knowledge ingestion and document processing capabilities.
    """

    def __init__(self, db: AsyncSession, organization_id: UUID):
        self.db = db
        self.organization_id = organization_id

    async def get_knowledge_groups(self, group_ids: list[UUID]) -> list[dict]:
        """
        Get knowledge groups by IDs.

        Reads from platform.knowledge_groups table.
        """
        if not group_ids:
            return []

        query = text("""
            SELECT
                id, name, description, status,
                document_count, created_at
            FROM platform.knowledge_groups
            WHERE id = ANY(:group_ids)
            AND organization_id = :org_id
            AND status = 'active'
        """)

        result = await self.db.execute(
            query,
            {"group_ids": group_ids, "org_id": str(self.organization_id)}
        )

        rows = result.fetchall()
        return [
            {
                "id": str(row.id),
                "name": row.name,
                "description": row.description,
                "status": row.status,
                "document_count": row.document_count,
                "created_at": row.created_at.isoformat() if row.created_at else None
            }
            for row in rows
        ]

    async def search_knowledge(
        self,
        query: str,
        knowledge_group_ids: list[UUID],
        limit: int = 5,
        similarity_threshold: float = 0.7
    ) -> list[dict]:
        """
        Search for relevant knowledge chunks using vector similarity.

        Uses the platform's existing vector embeddings for semantic search.
        """
        if not knowledge_group_ids:
            return []

        # Use platform's vector search
        # This assumes platform.knowledge_chunks has embeddings
        search_query = text("""
            WITH query_embedding AS (
                SELECT platform.generate_embedding(:query_text) as embedding
            )
            SELECT
                kc.id,
                kc.content,
                kc.metadata,
                kc.document_id,
                kd.title as document_title,
                1 - (kc.embedding <=> (SELECT embedding FROM query_embedding)) as similarity
            FROM platform.knowledge_chunks kc
            JOIN platform.knowledge_documents kd ON kd.id = kc.document_id
            JOIN platform.knowledge_groups kg ON kg.id = kd.knowledge_group_id
            WHERE kg.id = ANY(:group_ids)
            AND kg.organization_id = :org_id
            AND 1 - (kc.embedding <=> (SELECT embedding FROM query_embedding)) > :threshold
            ORDER BY similarity DESC
            LIMIT :limit
        """)

        try:
            result = await self.db.execute(
                search_query,
                {
                    "query_text": query,
                    "group_ids": knowledge_group_ids,
                    "org_id": str(self.organization_id),
                    "threshold": similarity_threshold,
                    "limit": limit
                }
            )

            rows = result.fetchall()
            return [
                {
                    "id": str(row.id),
                    "content": row.content,
                    "metadata": row.metadata,
                    "document_id": str(row.document_id),
                    "document_title": row.document_title,
                    "similarity": float(row.similarity)
                }
                for row in rows
            ]
        except Exception as e:
            # Fallback to simple text search if vector search fails
            return await self._fallback_text_search(query, knowledge_group_ids, limit)

    async def _fallback_text_search(
        self,
        query: str,
        knowledge_group_ids: list[UUID],
        limit: int
    ) -> list[dict]:
        """Fallback text-based search when vector search is unavailable."""
        search_query = text("""
            SELECT
                kc.id,
                kc.content,
                kc.metadata,
                kc.document_id,
                kd.title as document_title,
                ts_rank(to_tsvector('english', kc.content), plainto_tsquery('english', :query)) as rank
            FROM platform.knowledge_chunks kc
            JOIN platform.knowledge_documents kd ON kd.id = kc.document_id
            JOIN platform.knowledge_groups kg ON kg.id = kd.knowledge_group_id
            WHERE kg.id = ANY(:group_ids)
            AND kg.organization_id = :org_id
            AND to_tsvector('english', kc.content) @@ plainto_tsquery('english', :query)
            ORDER BY rank DESC
            LIMIT :limit
        """)

        try:
            result = await self.db.execute(
                search_query,
                {
                    "query": query,
                    "group_ids": knowledge_group_ids,
                    "org_id": str(self.organization_id),
                    "limit": limit
                }
            )

            rows = result.fetchall()
            return [
                {
                    "id": str(row.id),
                    "content": row.content,
                    "metadata": row.metadata,
                    "document_id": str(row.document_id),
                    "document_title": row.document_title,
                    "similarity": float(row.rank) if row.rank else 0.5
                }
                for row in rows
            ]
        except Exception:
            return []

    async def get_document_content(
        self,
        document_id: UUID,
        max_chunks: int = 10
    ) -> Optional[dict]:
        """
        Get full document content by combining chunks.
        """
        query = text("""
            SELECT
                kd.id,
                kd.title,
                kd.file_type,
                kd.metadata,
                array_agg(kc.content ORDER BY kc.chunk_index) as chunks
            FROM platform.knowledge_documents kd
            JOIN platform.knowledge_chunks kc ON kc.document_id = kd.id
            JOIN platform.knowledge_groups kg ON kg.id = kd.knowledge_group_id
            WHERE kd.id = :doc_id
            AND kg.organization_id = :org_id
            GROUP BY kd.id, kd.title, kd.file_type, kd.metadata
        """)

        result = await self.db.execute(
            query,
            {"doc_id": str(document_id), "org_id": str(self.organization_id)}
        )

        row = result.fetchone()
        if not row:
            return None

        chunks = row.chunks[:max_chunks] if row.chunks else []

        return {
            "id": str(row.id),
            "title": row.title,
            "file_type": row.file_type,
            "metadata": row.metadata,
            "content": "\n\n".join(chunks)
        }

    async def build_knowledge_context(
        self,
        question: str,
        knowledge_group_ids: list[UUID],
        max_tokens: int = 2000
    ) -> str:
        """
        Build a knowledge context string for AI prompts.

        Searches relevant knowledge and formats it for inclusion
        in persona response generation.
        """
        if not knowledge_group_ids:
            return ""

        # Search for relevant chunks
        chunks = await self.search_knowledge(
            query=question,
            knowledge_group_ids=knowledge_group_ids,
            limit=5
        )

        if not chunks:
            return ""

        # Format context
        context_parts = ["Relevant information from knowledge base:"]

        total_length = 0
        for chunk in chunks:
            chunk_text = f"\n---\nFrom: {chunk['document_title']}\n{chunk['content']}"

            # Rough token estimation (4 chars per token)
            chunk_tokens = len(chunk_text) // 4
            if total_length + chunk_tokens > max_tokens:
                break

            context_parts.append(chunk_text)
            total_length += chunk_tokens

        return "\n".join(context_parts)

    async def list_available_groups(
        self,
        page: int = 1,
        page_size: int = 20
    ) -> dict:
        """
        List knowledge groups available to the organization.
        """
        offset = (page - 1) * page_size

        # Count query
        count_query = text("""
            SELECT COUNT(*)
            FROM platform.knowledge_groups
            WHERE organization_id = :org_id
            AND status = 'active'
        """)

        count_result = await self.db.execute(
            count_query, {"org_id": str(self.organization_id)}
        )
        total = count_result.scalar() or 0

        # List query
        list_query = text("""
            SELECT
                id, name, description, status,
                document_count, created_at, updated_at
            FROM platform.knowledge_groups
            WHERE organization_id = :org_id
            AND status = 'active'
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """)

        result = await self.db.execute(
            list_query,
            {
                "org_id": str(self.organization_id),
                "limit": page_size,
                "offset": offset
            }
        )

        rows = result.fetchall()
        items = [
            {
                "id": str(row.id),
                "name": row.name,
                "description": row.description,
                "status": row.status,
                "document_count": row.document_count,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None
            }
            for row in rows
        ]

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "has_more": offset + len(items) < total
        }
