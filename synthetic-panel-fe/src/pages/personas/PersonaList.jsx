import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { personasApi, archetypesApi } from '../../services/api';
import { knowledgeGroupsApi, knowledgeSourcesApi } from '../../services/platformApi';

// Helper to get archetype name from either new or legacy source
function getArchetypeName(persona) {
  return persona.archetype?.name || persona.archetype?.archetype_name || persona.legacy_archetype?.archetype_name || null;
}

export default function PersonaList() {
  const [activeTab, setActiveTab] = useState('browse');

  // Browse state
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Selection state for bulk operations
  const [selectedPersonaIds, setSelectedPersonaIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [regeneratingAvatarId, setRegeneratingAvatarId] = useState(null);

  // Browse filters
  const [filterCountry, setFilterCountry] = useState('');
  const [filterLocationType, setFilterLocationType] = useState('');
  const [filterArchetype, setFilterArchetype] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Builder state - Demographics
  const [ageMin, setAgeMin] = useState(10);
  const [ageMax, setAgeMax] = useState(15);
  const [genderMale, setGenderMale] = useState(50);
  const [selectedCountries, setSelectedCountries] = useState(['Germany']);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [locationTypes, setLocationTypes] = useState({
    urban: true,
    suburban: true,
    smallTown: false,
    rural: false,
  });
  // Youth family options (for all ages)
  const [youthFamilyOptions, setYouthFamilyOptions] = useState({
    livesWithFamily: true,
    hasSiblings: true,
    onlyChild: true,
  });
  // Adult family options (only for 18+)
  const [adultFamilyOptions, setAdultFamilyOptions] = useState({
    married: true,
    single: true,
    hasKids: false,
  });

  // Check if any adults could be in the age range
  const includesAdults = ageMax >= 18;
  const youthOnly = ageMax < 18;

  // Builder state - Knowledge (from platform API)
  const [knowledgeGroups, setKnowledgeGroups] = useState([]);
  const [knowledgeSources, setKnowledgeSources] = useState([]);
  const [selectedKnowledgeGroups, setSelectedKnowledgeGroups] = useState([]);
  const [selectedKnowledgeSources, setSelectedKnowledgeSources] = useState([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);
  const [knowledgeSectionDone, setKnowledgeSectionDone] = useState(false);

  // Builder state - Archetypes
  const [archetypes, setArchetypes] = useState([]);
  const [selectedArchetypes, setSelectedArchetypes] = useState([]);
  const [archetypesLoading, setArchetypesLoading] = useState(true);

  // Builder state - Section progression
  const [archetypeSectionDone, setArchetypeSectionDone] = useState(false);

  // Check what's missing for generation
  const hasKnowledge = selectedKnowledgeGroups.length > 0 || selectedKnowledgeSources.length > 0;
  const hasArchetypes = selectedArchetypes.length > 0;

  // Builder state - Previews
  const [builderStep, setBuilderStep] = useState('configure');
  const [previews, setPreviews] = useState([]);
  const [selectedPreviews, setSelectedPreviews] = useState([]);
  const [previewsLoading, setPreviewsLoading] = useState(false);
  const [editingPreview, setEditingPreview] = useState(null);

  // Builder state - Persona generation
  const [generatingFull, setGeneratingFull] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ completed: 0, total: 0, failed: 0 });

  // Update a preview's field
  const updatePreview = (id, field, value) => {
    setPreviews(prev => prev.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ));
    setEditingPreview(null);
  };

  const availableCountries = [
    'Germany', 'United States', 'United Kingdom', 'France', 'Spain',
    'Italy', 'Netherlands', 'Belgium', 'Austria', 'Switzerland',
    'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland',
    'Australia', 'Canada', 'Japan', 'South Korea', 'Brazil'
  ];

  useEffect(() => {
    fetchPersonas();
    fetchArchetypes();
    fetchKnowledge();
  }, []);

  async function fetchKnowledge() {
    try {
      setKnowledgeLoading(true);
      const [groupsRes, sourcesRes] = await Promise.all([
        knowledgeGroupsApi.list({ limit: 100 }),
        knowledgeSourcesApi.list({ limit: 100 }),
      ]);
      setKnowledgeGroups(groupsRes.data?.items || groupsRes.data || []);
      setKnowledgeSources(sourcesRes.data?.items || sourcesRes.data || []);
    } catch (error) {
      console.error('Error fetching knowledge from platform:', error);
    } finally {
      setKnowledgeLoading(false);
    }
  }

  async function fetchArchetypes() {
    try {
      setArchetypesLoading(true);
      const res = await archetypesApi.list();
      const data = res.data;
      setArchetypes(data?.archetypes || data?.items || data || []);
    } catch (error) {
      console.error('Error fetching archetypes:', error);
    } finally {
      setArchetypesLoading(false);
    }
  }

  // Filter archetypes based on selected demographics (age range overlap)
  const filteredArchetypes = archetypes.filter((archetype) => {
    const archMin = archetype.age_min ?? 0;
    const archMax = archetype.age_max ?? 100;
    return ageMin <= archMax && ageMax >= archMin;
  });

  // Clear selected archetypes that are no longer in filtered list
  useEffect(() => {
    const filteredIds = new Set(filteredArchetypes.map(a => a.id));
    setSelectedArchetypes(prev => prev.filter(id => filteredIds.has(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageMin, ageMax, archetypes]);

  async function fetchPersonas() {
    try {
      const res = await personasApi.list();
      const data = res.data;
      setPersonas(data?.items || data || []);
    } catch (error) {
      console.error('Error fetching personas:', error);
    } finally {
      setLoading(false);
    }
  }

  // Delete single persona with window.confirm
  async function confirmDeleteSingle(id) {
    if (!window.confirm('Are you sure you want to delete this persona? This action cannot be undone.')) return;
    setIsDeleting(true);
    try {
      await personasApi.delete(id);
      setPersonas(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting persona:', error);
    } finally {
      setIsDeleting(false);
    }
  }

  // Regenerate avatar
  async function handleRegenerateAvatar(personaId) {
    setRegeneratingAvatarId(personaId);
    try {
      // Dispatch avatar generation task
      const res = await personasApi.generateAvatar(personaId);
      const taskId = res.data?.task_id;

      if (taskId) {
        // Poll for completion
        for (let i = 0; i < 40; i++) { // max ~2 minutes
          await new Promise(r => setTimeout(r, 3000));
          const status = await personasApi.batchGenerateStatus(taskId);
          if (status.data?.status === 'completed') break;
          if (status.data?.status === 'failed') {
            throw new Error(status.data?.error || 'Avatar generation failed');
          }
        }
      } else {
        // Fallback: just wait
        await new Promise(r => setTimeout(r, 20000));
      }

      await fetchPersonas();
    } catch (error) {
      console.error('Error regenerating avatar:', error);
      alert('Failed to regenerate avatar. Please try again.');
    } finally {
      setRegeneratingAvatarId(null);
    }
  }

  // Bulk delete with window.confirm
  async function confirmDeleteBulk() {
    if (selectedPersonaIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedPersonaIds.size} persona${selectedPersonaIds.size !== 1 ? 's' : ''}? This action cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await Promise.all(
        Array.from(selectedPersonaIds).map(id => personasApi.delete(id))
      );
      setPersonas(prev => prev.filter(c => !selectedPersonaIds.has(c.id)));
      setSelectedPersonaIds(new Set());
    } catch (error) {
      console.error('Error deleting personas:', error);
    } finally {
      setIsDeleting(false);
    }
  }

  // Toggle single persona selection
  function togglePersonaSelection(id) {
    setSelectedPersonaIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }

  // Toggle all personas selection
  function toggleSelectAll() {
    if (selectedPersonaIds.size === filteredPersonas.length) {
      setSelectedPersonaIds(new Set());
    } else {
      setSelectedPersonaIds(new Set(filteredPersonas.map(p => p.id)));
    }
  }

  async function generatePreviews() {
    setPreviewsLoading(true);
    try {
      // Build archetypes array from selected archetypes (or create generic)
      let archetypePayloads = archetypes
        .filter(a => selectedArchetypes.includes(a.id))
        .map(a => ({
          id: a.id,
          name: a.name || a.archetype_name,
          description: a.description || '',
          driver: a.driver || '',
          core_value: a.core_value || '',
          age_min: a.age_min ?? ageMin,
          age_max: a.age_max ?? ageMax,
        }));

      if (archetypePayloads.length === 0) {
        archetypePayloads = [{
          id: 'generic',
          name: 'General Persona',
          description: 'A diverse persona based on the selected demographics',
          driver: '',
          core_value: '',
          age_min: ageMin,
          age_max: ageMax,
        }];
      }

      // Build demographics object from state
      const demographics = {
        age_range: { min: ageMin, max: ageMax },
        gender_ratio: { male: genderMale, female: 100 - genderMale },
        countries: selectedCountries,
        location_types: Object.entries(locationTypes).filter(([, v]) => v).map(([k]) => k),
        youth_family: Object.entries(youthFamilyOptions).filter(([, v]) => v).map(([k]) => k),
        adult_family: includesAdults ? Object.entries(adultFamilyOptions).filter(([, v]) => v).map(([k]) => k) : [],
      };

      // Call AI preview generation via celery task
      const result = await personasApi.previewPersonasAndWait({
        archetypes: archetypePayloads,
        demographics,
        variations_per_archetype: 3,
        knowledge_group_ids: selectedKnowledgeGroups.length > 0 ? selectedKnowledgeGroups : undefined,
      });

      if (!result || !result.success) {
        throw new Error(result?.error || 'Preview generation failed');
      }

      handlePreviewsReady(result.previews);
    } catch (error) {
      console.error('Error generating previews:', error);
    } finally {
      setPreviewsLoading(false);
    }
  }

  function handlePreviewsReady(previewData) {
    setPreviews(previewData);
    const firstPerArchetype = Object.values(
      previewData.reduce((acc, p) => {
        if (!acc[p.archetype_id]) acc[p.archetype_id] = p;
        return acc;
      }, {})
    ).map(p => p.id);
    setSelectedPreviews(firstPerArchetype);
    setBuilderStep('preview');
  }

  async function generateFullPersonas() {
    setGeneratingFull(true);
    try {
      const selectedPreviewObjects = previews.filter(p => selectedPreviews.includes(p.id));

      // Find the archetype objects for driver/core_value enrichment
      const archetypeMap = {};
      archetypes.forEach(a => { archetypeMap[a.id] = a; });

      // Build previews payload for batch generation
      const previewPayloads = selectedPreviewObjects.map(preview => {
        const arch = preview.archetype_id !== 'generic' ? archetypeMap[preview.archetype_id] : null;
        return {
          name: preview.suggested_name || preview.name,
          age: preview.suggested_age || preview.age,
          gender: preview.suggested_gender || preview.gender,
          country: preview.country,
          city: preview.suggested_city || preview.city || undefined,
          archetype_id: preview.archetype_id !== 'generic' ? preview.archetype_id : undefined,
          archetype_name: preview.archetype_name || (arch ? (arch.name || arch.archetype_name) : undefined),
          archetype_driver: arch?.driver || undefined,
          archetype_core_value: arch?.core_value || undefined,
        };
      });

      // Dispatch batch generation
      const knowledgeGroupIds = selectedKnowledgeGroups.length > 0 ? selectedKnowledgeGroups : undefined;
      const response = await personasApi.batchGenerate({
        previews: previewPayloads,
        generate_backstories: true,
        generate_avatars: true,
        knowledge_group_ids: knowledgeGroupIds,
      });

      const { task_ids, persona_ids } = response.data;
      const total = task_ids.length;
      setGenerationProgress({ completed: 0, total, failed: 0 });

      // Poll all tasks for completion
      const pollTask = async (taskId) => {
        const maxAttempts = 60; // 5 minutes at 5s intervals
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          try {
            const statusRes = await personasApi.batchGenerateStatus(taskId);
            const taskStatus = statusRes.data.status;
            if (taskStatus === 'completed') {
              return 'completed';
            } else if (taskStatus === 'failed') {
              return 'failed';
            }
            // still processing, keep polling
          } catch (err) {
            console.error('Error polling task status:', err);
          }
        }
        return 'timeout';
      };

      // Poll all tasks in parallel and update progress
      let completedCount = 0;
      let failedCount = 0;

      const pollPromises = task_ids.map(async (taskId) => {
        const result = await pollTask(taskId);
        if (result === 'completed') {
          completedCount++;
        } else {
          failedCount++;
        }
        setGenerationProgress({ completed: completedCount, total, failed: failedCount });
        return result;
      });

      await Promise.all(pollPromises);

      if (completedCount > 0 || persona_ids.length > 0) {
        // Reset builder state
        setPreviews([]);
        setSelectedPreviews([]);
        setBuilderStep('configure');
        setArchetypeSectionDone(false);

        // Switch to browse tab and refresh list
        setActiveTab('browse');
        setSortBy('created');
        setSortOrder('desc');
        await fetchPersonas();
      } else {
        console.error('No personas generated successfully');
      }
    } catch (error) {
      console.error('Error generating full personas:', error);
    } finally {
      setGeneratingFull(false);
      setGenerationProgress({ completed: 0, total: 0, failed: 0 });
    }
  }

  // View and sort state
  const [viewMode, setViewMode] = useState('card');
  const [sortBy, setSortBy] = useState('created');
  const [sortOrder, setSortOrder] = useState('desc');

  // Get unique values for filter dropdowns
  const uniqueCountries = [...new Set(personas.map(p => p.country).filter(Boolean))].sort();
  const uniqueLocationTypes = [...new Set(personas.map(p => p.location_type).filter(Boolean))].sort();
  const uniqueArchetypes = [...new Set(personas.map(p => p.archetype?.archetype_name).filter(Boolean))].sort();

  // Filter and sort personas
  const filteredPersonas = personas
    .filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCountry && p.country !== filterCountry) return false;
      if (filterLocationType && p.location_type !== filterLocationType) return false;
      if (filterArchetype && p.archetype?.archetype_name !== filterArchetype) return false;
      if (filterGender && p.gender !== filterGender) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'age':
          comparison = a.age - b.age;
          break;
        case 'country':
          comparison = (a.country || '').localeCompare(b.country || '');
          break;
        case 'created':
        default:
          comparison = 0;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const activeFiltersCount = [filterCountry, filterLocationType, filterArchetype, filterGender].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 relative">
      {/* Full-page generating overlay */}
      {(previewsLoading || generatingFull) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-2xl max-w-md mx-4 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {previewsLoading ? 'Generating Persona Previews' : 'Creating Full Personas'}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {previewsLoading
                ? 'AI is analyzing your requirements and creating diverse persona variations. This may take a minute...'
                : generationProgress.total > 0
                  ? `Generating profiles, backstories, and avatars...`
                  : 'Starting persona generation...'
              }
            </p>
            {generatingFull && generationProgress.total > 0 && (
              <div className="space-y-2">
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(((generationProgress.completed + generationProgress.failed) / generationProgress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500">
                  {generationProgress.completed} of {generationProgress.total} completed
                  {generationProgress.failed > 0 && (
                    <span className="text-red-500 ml-1">({generationProgress.failed} failed)</span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">Personas</h1>
          <p className="text-gray-500 mt-1">
            Create and manage AI personas for your synthetic panel
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-6">
            {[
              { id: 'browse', label: 'Browse' },
              { id: 'builder', label: 'Builder' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 border-b-2 font-medium transition ${
                  activeTab === tab.id
                    ? 'border-primary text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <div>
            {/* Search, Filters & Controls */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 space-y-4 shadow-sm">
              {/* Top row: Search, View toggle, Create */}
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search personas..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-900 placeholder-gray-400"
                  />
                </div>

                {/* View toggle */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('card')}
                    className={`p-2 rounded transition ${viewMode === 'card' ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-900'}`}
                    title="Card view"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded transition ${viewMode === 'list' ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-900'}`}
                    title="List view"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>

                {/* Filter toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-3 py-2 rounded-lg transition flex items-center gap-2 ${
                    showFilters || activeFiltersCount > 0
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filters
                  {activeFiltersCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-black/10 rounded text-xs">{activeFiltersCount}</span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('builder')}
                  className="px-4 py-2 bg-primary hover:opacity-90 text-white rounded-lg font-medium transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create
                </button>
              </div>

              {/* Filters row */}
              {showFilters && (
                <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-200">
                  {/* Country filter */}
                  <select
                    value={filterCountry}
                    onChange={(e) => setFilterCountry(e.target.value)}
                    className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary text-gray-900"
                  >
                    <option value="">All Countries</option>
                    {uniqueCountries.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  {/* Location type filter */}
                  <select
                    value={filterLocationType}
                    onChange={(e) => setFilterLocationType(e.target.value)}
                    className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary text-gray-900"
                  >
                    <option value="">All Location Types</option>
                    {uniqueLocationTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>

                  {/* Archetype filter */}
                  <select
                    value={filterArchetype}
                    onChange={(e) => setFilterArchetype(e.target.value)}
                    className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary text-gray-900"
                  >
                    <option value="">All Archetypes</option>
                    {uniqueArchetypes.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>

                  {/* Gender filter */}
                  <select
                    value={filterGender}
                    onChange={(e) => setFilterGender(e.target.value)}
                    className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary text-gray-900"
                  >
                    <option value="">All Genders</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>

                  {/* Sort by */}
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-gray-400">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary text-gray-900"
                    >
                      <option value="created">Created</option>
                      <option value="name">Name</option>
                      <option value="age">Age</option>
                      <option value="country">Country</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="p-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition"
                      title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                    >
                      {sortOrder === 'asc' ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Clear filters */}
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={() => {
                        setFilterCountry('');
                        setFilterLocationType('');
                        setFilterArchetype('');
                        setFilterGender('');
                      }}
                      className="px-3 py-2 text-sm text-red-500 hover:text-red-400 transition"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              )}

              {/* Results count */}
              <div className="flex items-center justify-between text-sm text-gray-400">
                <span>{filteredPersonas.length} persona{filteredPersonas.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedPersonaIds.size > 0 && (
              <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-lg px-4 py-3 mb-6">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedPersonaIds.size === filteredPersonas.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 bg-white text-primary focus:ring-primary cursor-pointer"
                  />
                  <span className="text-sm font-medium text-primary">
                    {selectedPersonaIds.size} selected
                  </span>
                  <button
                    onClick={() => setSelectedPersonaIds(new Set())}
                    className="text-sm text-gray-500 hover:text-gray-900 transition"
                  >
                    Clear selection
                  </button>
                </div>
                <button
                  onClick={confirmDeleteBulk}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {isDeleting ? 'Deleting...' : 'Delete selected'}
                </button>
              </div>
            )}

            {/* Results */}
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading personas...</div>
            ) : filteredPersonas.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium mb-2">No personas found</h3>
                <p className="text-gray-500 mb-4">
                  {search ? 'Try adjusting your search' : 'Create your first personas to get started'}
                </p>
                <button
                  onClick={() => setActiveTab('builder')}
                  className="px-4 py-2 bg-primary hover:opacity-90 text-white rounded-lg font-medium transition"
                >
                  Create Personas
                </button>
              </div>
            ) : viewMode === 'card' ? (
              /* Card View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredPersonas.map((persona) => (
                  <div
                    key={persona.id}
                    className={`bg-white backdrop-blur border rounded-2xl overflow-hidden transition-all duration-300 group hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 ${
                      selectedPersonaIds.has(persona.id)
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-gray-200/50 hover:border-primary/50'
                    }`}
                  >
                    {/* Avatar with overlay */}
                    <div className="block aspect-[4/5] bg-gray-100 relative overflow-hidden">
                      {/* Selection checkbox */}
                      <div
                        className="absolute top-3 left-3 z-20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPersonaIds.has(persona.id)}
                          onChange={() => togglePersonaSelection(persona.id)}
                          className="w-5 h-5 rounded border-gray-300 bg-white/80 text-primary focus:ring-primary cursor-pointer"
                        />
                      </div>
                      <Link to={`/personas/${persona.id}`} className="block w-full h-full relative">
                        {persona.avatar_url ? (
                          <img
                            src={persona.avatar_url}
                            alt={persona.name}
                            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-tertiary/20">
                            <div className="w-28 h-28 bg-gradient-to-br from-primary to-tertiary rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-lg">
                              {persona.name[0]}
                            </div>
                          </div>
                        )}
                      </Link>

                      {/* Gradient overlay at bottom */}
                      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent pointer-events-none" />

                      {/* Archetype tag overlay */}
                      {getArchetypeName(persona) && (
                        <span className="absolute top-3 right-3 px-2.5 py-1 bg-gradient-to-r from-primary/90 to-tertiary/90 backdrop-blur-sm text-white rounded-full text-xs font-medium shadow-lg">
                          {getArchetypeName(persona)}
                        </span>
                      )}

                      {/* Name overlay at bottom of image */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                        <Link to={`/personas/${persona.id}`}>
                          <h3 className="font-bold text-xl text-white group-hover:text-primary/80 transition drop-shadow-lg">
                            {persona.name}
                          </h3>
                        </Link>
                        <p className="text-gray-300 text-sm">
                          {persona.age} years old &bull; {persona.city || persona.country}
                        </p>
                      </div>
                    </div>

                    {/* Info Section */}
                    <div className="p-4 space-y-2.5 bg-white">
                      {/* Occupation */}
                      {persona.occupation && (
                        <p className="text-sm font-medium text-gray-700">{persona.occupation}</p>
                      )}

                      {/* Personality snippet */}
                      {persona.personality && (
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {typeof persona.personality === 'string'
                            ? persona.personality
                            : persona.personality?.profile_notes || persona.personality?.description || ''}
                        </p>
                      )}

                      {/* Location + gender */}
                      <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                        {persona.gender && (
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 capitalize">{persona.gender}</span>
                        )}
                        {persona.country && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            {persona.country}
                          </span>
                        )}
                        {persona.education && (
                          <span>&bull; {persona.education}</span>
                        )}
                      </div>

                      {/* Quirks or interests as tags */}
                      {(persona.quirks?.length > 0 || persona.catchphrases?.length > 0) && (
                        <div className="flex flex-wrap gap-1">
                          {(persona.quirks || []).slice(0, 2).map((q, i) => (
                            <span key={i} className="px-2 py-0.5 bg-primary/5 text-primary rounded-full text-[10px] truncate max-w-[140px]">
                              {q}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRegenerateAvatar(persona.id);
                          }}
                          className={`p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition ${regeneratingAvatarId === persona.id ? 'animate-spin' : ''}`}
                          title="Regenerate avatar"
                          disabled={regeneratingAvatarId === persona.id}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            confirmDeleteSingle(persona.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Delete persona"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* List View */
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-300 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="col-span-1 flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedPersonaIds.size === filteredPersonas.length && filteredPersonas.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 bg-white text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>
                  <div className="col-span-2">Persona</div>
                  <div className="col-span-1">Age</div>
                  <div className="col-span-1">Gender</div>
                  <div className="col-span-2">Country</div>
                  <div className="col-span-1">Location</div>
                  <div className="col-span-2">Archetype</div>
                  <div className="col-span-2">Family</div>
                </div>
                {/* Rows */}
                {filteredPersonas.map((persona) => (
                  <Link
                    to={`/personas/${persona.id}`}
                    key={persona.id}
                    className={`grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-200 hover:bg-gray-50 transition items-center group cursor-pointer ${
                      selectedPersonaIds.has(persona.id) ? 'bg-primary/5' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="col-span-1 flex items-center" onClick={(e) => e.preventDefault()}>
                      <input
                        type="checkbox"
                        checked={selectedPersonaIds.has(persona.id)}
                        onChange={() => togglePersonaSelection(persona.id)}
                        className="w-4 h-4 rounded border-gray-300 bg-white text-primary focus:ring-primary cursor-pointer"
                      />
                    </div>
                    {/* Name + Avatar */}
                    <div className="col-span-2 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 relative">
                        {persona.avatar_url ? (
                          <img src={persona.avatar_url} alt={persona.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary to-tertiary flex items-center justify-center text-sm font-bold text-white">
                            {persona.name[0]}
                          </div>
                        )}
                      </div>
                      <span className="font-medium group-hover:text-primary transition truncate">{persona.name}</span>
                    </div>
                    {/* Age */}
                    <div className="col-span-1 text-sm text-gray-500">{persona.age}</div>
                    {/* Gender */}
                    <div className="col-span-1 text-sm text-gray-500 capitalize">{persona.gender}</div>
                    {/* Country */}
                    <div className="col-span-2">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                        {persona.country}
                      </span>
                    </div>
                    {/* Location Type */}
                    <div className="col-span-1">
                      {persona.location_type && (
                        <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-xs">
                          {persona.location_type}
                        </span>
                      )}
                    </div>
                    {/* Archetype */}
                    <div className="col-span-2">
                      {getArchetypeName(persona) && (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs truncate inline-block max-w-full">
                          {getArchetypeName(persona)}
                        </span>
                      )}
                    </div>
                    {/* Family */}
                    <div className="col-span-2 flex items-center justify-between">
                      {persona.family_situation && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-xs truncate max-w-[120px]" title={persona.family_situation}>
                          {persona.family_situation}
                        </span>
                      )}
                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          confirmDeleteSingle(persona.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition ml-auto"
                        title="Delete persona"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Builder Tab */}
        {activeTab === 'builder' && (
          <div className="space-y-6">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setBuilderStep('configure')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                  builderStep === 'configure'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-500 hover:text-gray-900'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">1</span>
                Configure
              </button>
              <div className="h-px flex-1 bg-gray-300 max-w-8" />
              <button
                onClick={() => previews.length > 0 && setBuilderStep('preview')}
                disabled={previews.length === 0}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                  builderStep === 'preview'
                    ? 'bg-primary text-white'
                    : previews.length > 0
                    ? 'bg-gray-100 text-gray-500 hover:text-gray-900'
                    : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">2</span>
                Preview &amp; Create
              </button>
            </div>

            {builderStep === 'configure' && (
              <>
                {/* Demographics */}
                <div className="relative overflow-hidden bg-gradient-to-br from-white via-white to-gray-50 border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                  <div className="relative">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Demographics</h2>
                        <p className="text-gray-400 text-sm">Target audience characteristics</p>
                      </div>
                    </div>

                    {/* Age & Gender Sub-box */}
                    <div className="p-4 bg-gray-50/50 border border-gray-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-sm font-semibold text-gray-700">Age &amp; Gender</span>
                      </div>

                      {/* Age Range Slider */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <label className="block text-xs text-gray-500">Age Range</label>
                          <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                            <input
                              type="number"
                              min={10}
                              max={100}
                              value={ageMin}
                              onChange={(e) => setAgeMin(Math.min(Math.max(10, parseInt(e.target.value) || 10), ageMax))}
                              className="w-12 bg-transparent border-b border-gray-300 focus:border-primary text-center outline-none"
                            />
                            <span className="text-gray-400">-</span>
                            <input
                              type="number"
                              min={10}
                              max={100}
                              value={ageMax}
                              onChange={(e) => setAgeMax(Math.max(Math.min(100, parseInt(e.target.value) || 100), ageMin))}
                              className="w-12 bg-transparent border-b border-gray-300 focus:border-primary text-center outline-none"
                            />
                            <span className="text-gray-400">years</span>
                          </div>
                        </div>
                        <div className="relative h-6 flex items-center">
                          <div className="absolute inset-x-0 h-1.5 bg-gray-200 rounded-full" />
                          <div
                            className="absolute h-1.5 bg-gradient-to-r from-primary to-tertiary rounded-full"
                            style={{
                              left: `${((ageMin - 10) / 90) * 100}%`,
                              right: `${((100 - ageMax) / 90) * 100}%`
                            }}
                          />
                          <input
                            type="range"
                            min={10}
                            max={100}
                            value={ageMin}
                            onChange={(e) => setAgeMin(Math.min(Number(e.target.value), ageMax))}
                            className="absolute inset-x-0 h-6 appearance-none bg-transparent pointer-events-none z-20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-runnable-track]:bg-transparent"
                          />
                          <input
                            type="range"
                            min={10}
                            max={100}
                            value={ageMax}
                            onChange={(e) => setAgeMax(Math.max(Number(e.target.value), ageMin))}
                            className="absolute inset-x-0 h-6 appearance-none bg-transparent pointer-events-none z-20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-tertiary [&::-webkit-slider-runnable-track]:bg-transparent"
                          />
                        </div>
                        <div className="flex justify-between text-xs mt-2 text-gray-400">
                          <span>10</span>
                          <span>25</span>
                          <span>40</span>
                          <span>55</span>
                          <span>70</span>
                          <span>85</span>
                          <span>100</span>
                        </div>
                      </div>

                      {/* Gender Distribution */}
                      <div className="md:w-1/2">
                        <div className="flex items-center justify-between mb-3">
                          <label className="block text-xs text-gray-500">Gender Mix</label>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-blue-500">{genderMale}% M</span>
                            <span className="text-gray-300">/</span>
                            <span className="text-pink-500">{100 - genderMale}% F</span>
                          </div>
                        </div>
                        <div className="relative h-6 flex items-center">
                          <div className="absolute inset-x-0 h-2 rounded-full overflow-hidden flex">
                            <div className="bg-blue-500 transition-all" style={{ width: `${genderMale}%` }} />
                            <div className="bg-pink-500 transition-all" style={{ width: `${100 - genderMale}%` }} />
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={genderMale}
                            onChange={(e) => setGenderMale(Number(e.target.value))}
                            className="absolute inset-x-0 h-6 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-gray-300 [&::-webkit-slider-runnable-track]:bg-transparent"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Location Sub-box */}
                    <div className="mt-6 p-4 bg-gray-50/50 border border-gray-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm font-semibold text-gray-700">Location</span>
                      </div>

                      {/* Countries */}
                      <div className="mb-4 md:w-1/2">
                        <label className="block text-xs text-gray-500 mb-2">Countries</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-left focus:outline-none focus:border-primary transition-all flex items-center justify-between"
                          >
                            <span className={selectedCountries.length > 0 ? 'text-gray-900' : 'text-gray-400'}>
                              {selectedCountries.length > 0
                                ? selectedCountries.length === 1
                                  ? selectedCountries[0]
                                  : `${selectedCountries.length} countries selected`
                                : 'Select countries...'}
                            </span>
                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {showCountryDropdown && (
                            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                              {availableCountries.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCountries(prev =>
                                      prev.includes(c)
                                        ? prev.filter(x => x !== c)
                                        : [...prev, c]
                                    );
                                  }}
                                  className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                    selectedCountries.includes(c)
                                      ? 'bg-primary border-primary'
                                      : 'border-gray-300'
                                  }`}>
                                    {selectedCountries.includes(c) && (
                                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                  {c}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {selectedCountries.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {selectedCountries.map((c) => (
                              <span
                                key={c}
                                className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs flex items-center gap-1"
                              >
                                {c}
                                <button
                                  onClick={() => setSelectedCountries(prev => prev.filter(x => x !== c))}
                                  className="hover:text-gray-900"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Location Types */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-2">Type</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { key: 'urban', label: 'Urban' },
                            { key: 'suburban', label: 'Suburban' },
                            { key: 'smallTown', label: 'Small Town' },
                            { key: 'rural', label: 'Rural' },
                          ].map(({ key, label }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setLocationTypes(prev => ({ ...prev, [key]: !prev[key] }))}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                                locationTypes[key]
                                  ? 'bg-primary/10 border-primary/50 text-gray-900'
                                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all ${
                                locationTypes[key]
                                  ? 'bg-primary border-primary'
                                  : 'border-gray-300'
                              }`}>
                                {locationTypes[key] && (
                                  <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Family Sub-box */}
                    <div className="mt-6 p-4 bg-gray-50/50 border border-gray-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="text-sm font-semibold text-gray-700">Family</span>
                      </div>

                      {/* Youth Options */}
                      <div className="mb-4">
                        <label className="block text-xs text-gray-500 mb-2">Youth Options</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { key: 'livesWithFamily', label: 'Lives with Family' },
                            { key: 'hasSiblings', label: 'Has Siblings' },
                            { key: 'onlyChild', label: 'Only Child' },
                          ].map(({ key, label }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setYouthFamilyOptions(prev => ({ ...prev, [key]: !prev[key] }))}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                                youthFamilyOptions[key]
                                  ? 'bg-primary/10 border-primary/50 text-gray-900'
                                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all ${
                                youthFamilyOptions[key]
                                  ? 'bg-primary border-primary'
                                  : 'border-gray-300'
                              }`}>
                                {youthFamilyOptions[key] && (
                                  <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Adult Options - only shown if age range includes 18+ */}
                      {includesAdults && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-xs text-gray-500">Adult Options (18+)</label>
                            {!youthOnly && ageMin < 18 && (
                              <span className="text-xs text-amber-500/70">Only applies to personas 18+</span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { key: 'married', label: 'Married' },
                              { key: 'single', label: 'Single' },
                              { key: 'hasKids', label: 'Has Kids' },
                            ].map(({ key, label }) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setAdultFamilyOptions(prev => ({ ...prev, [key]: !prev[key] }))}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                                  adultFamilyOptions[key]
                                    ? 'bg-primary/10 border-primary/50 text-gray-900'
                                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}
                              >
                                <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all ${
                                  adultFamilyOptions[key]
                                    ? 'bg-primary border-primary'
                                    : 'border-gray-300'
                                }`}>
                                  {adultFamilyOptions[key] && (
                                    <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Knowledge (from Platform API) */}
                <div className="relative overflow-hidden bg-gradient-to-br from-white via-white to-gray-50 border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl translate-y-[-50%] translate-x-[50%]" />

                  <div className="relative">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">Knowledge</h2>
                          <p className="text-gray-400 text-sm">
                            {knowledgeLoading ? 'Loading...' : `${knowledgeGroups.length} groups, ${knowledgeSources.length} sources`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {knowledgeLoading ? (
                      <div className="text-center py-8 text-gray-500">Loading knowledge from platform...</div>
                    ) : (
                      <div className="space-y-4">
                        {/* Knowledge Groups */}
                        {knowledgeGroups.length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Knowledge Groups</h3>
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                              {knowledgeGroups.map((group) => {
                                const isSelected = selectedKnowledgeGroups.includes(group.id)
                                return (
                                  <button
                                    key={group.id}
                                    type="button"
                                    onClick={() => setSelectedKnowledgeGroups(prev =>
                                      isSelected ? prev.filter(id => id !== group.id) : [...prev, group.id]
                                    )}
                                    className={`text-left p-3 rounded-xl border transition-all ${
                                      isSelected
                                        ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/30'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                        isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                                      }`}>
                                        {isSelected && (
                                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-medium text-gray-900 text-sm truncate">{group.name}</p>
                                        {group.description && (
                                          <p className="text-xs text-gray-400 truncate">{group.description}</p>
                                        )}
                                        {group.source_count != null && (
                                          <p className="text-xs text-gray-400">{group.source_count} sources</p>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Knowledge Sources */}
                        {knowledgeSources.length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Individual Sources</h3>
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                              {knowledgeSources.map((source) => {
                                const isSelected = selectedKnowledgeSources.includes(source.id)
                                return (
                                  <button
                                    key={source.id}
                                    type="button"
                                    onClick={() => setSelectedKnowledgeSources(prev =>
                                      isSelected ? prev.filter(id => id !== source.id) : [...prev, source.id]
                                    )}
                                    className={`text-left p-3 rounded-xl border transition-all ${
                                      isSelected
                                        ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/30'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                        isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                                      }`}>
                                        {isSelected && (
                                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-medium text-gray-900 text-sm truncate">{source.title}</p>
                                        <p className="text-xs text-gray-400">{source.source_type || 'document'}</p>
                                      </div>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {knowledgeGroups.length === 0 && knowledgeSources.length === 0 && (
                          <div className="text-center py-6 text-gray-400 text-sm">
                            No knowledge sources found in the platform. Upload documents in the platform to use them here.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Summary */}
                    <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                      <p className="text-sm text-gray-500">
                        {hasKnowledge ? (
                          <>{selectedKnowledgeGroups.length} group{selectedKnowledgeGroups.length !== 1 ? 's' : ''}, {selectedKnowledgeSources.length} source{selectedKnowledgeSources.length !== 1 ? 's' : ''} selected</>
                        ) : (
                          <span className="text-gray-400">No knowledge selected (optional)</span>
                        )}
                      </p>
                      {!knowledgeSectionDone ? (
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setKnowledgeSectionDone(true)} className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-900 transition">
                            Skip
                          </button>
                          <button type="button" onClick={() => setKnowledgeSectionDone(true)} className="px-4 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition">
                            Continue
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setKnowledgeSectionDone(false)} className="px-3 py-1 text-xs text-gray-400 hover:text-gray-900 transition">
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Archetypes */}
                <div className="relative overflow-hidden bg-gradient-to-br from-white via-white to-gray-50 border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />

                  <div className="relative">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">Archetypes</h2>
                          <p className="text-gray-400 text-sm">
                            {archetypesLoading ? 'Loading...' : `${filteredArchetypes.length} matching age ${ageMin}-${ageMax}`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {archetypesLoading ? (
                      <div className="text-center py-8 text-gray-500">Loading archetypes...</div>
                    ) : filteredArchetypes.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <p className="text-gray-500 mb-4">No archetypes match the selected age range ({ageMin}-{ageMax})</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredArchetypes.map((archetype) => (
                          <button
                            key={archetype.id}
                            type="button"
                            onClick={() => {
                              setSelectedArchetypes(prev =>
                                prev.includes(archetype.id)
                                  ? prev.filter(id => id !== archetype.id)
                                  : [...prev, archetype.id]
                              );
                            }}
                            className={`p-4 rounded-xl border text-left transition-all ${
                              selectedArchetypes.includes(archetype.id)
                                ? 'bg-primary/10 border-primary/50'
                                : 'bg-white border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-semibold text-gray-900">{archetype.name || archetype.archetype_name}</h3>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                selectedArchetypes.includes(archetype.id)
                                  ? 'bg-primary border-primary'
                                  : 'border-gray-300'
                              }`}>
                                {selectedArchetypes.includes(archetype.id) && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            {archetype.description && (
                              <p className="text-sm text-gray-500 mb-2 line-clamp-2">{archetype.description}</p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              {archetype.age_min && archetype.age_max && (
                                <span className="px-2 py-0.5 bg-gray-100 rounded">
                                  {archetype.age_min}-{archetype.age_max} yrs
                                </span>
                              )}
                              {archetype.core_value && (
                                <span className="px-2 py-0.5 bg-gray-100 rounded">
                                  {archetype.core_value}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Summary & Actions */}
                    <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                      <p className="text-sm text-gray-500">
                        {hasArchetypes ? (
                          <>{selectedArchetypes.length} archetype{selectedArchetypes.length !== 1 ? 's' : ''} selected</>
                        ) : (
                          <span className="text-gray-400">No archetypes selected (optional)</span>
                        )}
                      </p>
                      {!archetypeSectionDone && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setArchetypeSectionDone(true)}
                            className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-900 transition"
                          >
                            Skip
                          </button>
                          <button
                            type="button"
                            onClick={() => setArchetypeSectionDone(true)}
                            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition"
                          >
                            Continue
                          </button>
                        </div>
                      )}
                      {archetypeSectionDone && (
                        <button
                          type="button"
                          onClick={() => setArchetypeSectionDone(false)}
                          className="px-3 py-1 text-xs text-gray-400 hover:text-gray-900 transition"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Configure Actions - shown after archetype section is done */}
                {archetypeSectionDone && (
                  <div className="space-y-4">
                    {/* Warnings */}
                    {(!hasKnowledge || !hasArchetypes) && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <p className="text-amber-700 font-medium">Some sections are empty</p>
                            <ul className="text-sm text-amber-600 mt-1 space-y-1">
                              {!hasKnowledge && (
                                <li>&bull; <strong>No Knowledge</strong> - Personas will lack research-based context</li>
                              )}
                              {!hasArchetypes && (
                                <li>&bull; <strong>No Archetypes</strong> - Personas will be generated with basic AI-created personalities</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setActiveTab('browse')}
                        className="px-6 py-2 text-gray-500 hover:text-gray-900 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={generatePreviews}
                        disabled={previewsLoading}
                        className="px-6 py-2 bg-primary hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition flex items-center gap-2"
                      >
                        {previewsLoading ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Generating persona previews...
                          </>
                        ) : (
                          'Generate Previews'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Preview Step */}
            {builderStep === 'preview' && (
              <>
                {/* Previews grouped by archetype */}
                {Object.entries(
                  previews.reduce((acc, preview) => {
                    const archetypeName = preview.archetype_name || 'Other';
                    if (!acc[archetypeName]) acc[archetypeName] = [];
                    acc[archetypeName].push(preview);
                    return acc;
                  }, {})
                ).map(([archetypeName, archetypePreviews]) => (
                  <div key={archetypeName} className="relative overflow-hidden bg-gradient-to-br from-white via-white to-gray-50 border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">{archetypeName}</h3>
                      <span className="text-sm text-gray-500">
                        {archetypePreviews.filter(p => selectedPreviews.includes(p.id)).length} / {archetypePreviews.length} selected
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {archetypePreviews.map((preview) => (
                        <div
                          key={preview.id}
                          onClick={() => {
                            setSelectedPreviews(prev =>
                              prev.includes(preview.id)
                                ? prev.filter(id => id !== preview.id)
                                : [...prev, preview.id]
                            );
                          }}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            selectedPreviews.includes(preview.id)
                              ? 'bg-primary/10 border-primary/50'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-gray-900">{preview.suggested_name}</h4>
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                selectedPreviews.includes(preview.id)
                                  ? 'bg-primary border-primary'
                                  : 'border-gray-300'
                              }`}
                            >
                              {selectedPreviews.includes(preview.id) && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {/* Age - editable */}
                            {editingPreview?.id === preview.id && editingPreview?.field === 'suggested_age' ? (
                              <input
                                type="number"
                                min={ageMin}
                                max={ageMax}
                                defaultValue={preview.suggested_age}
                                autoFocus
                                onBlur={(e) => updatePreview(preview.id, 'suggested_age', parseInt(e.target.value))}
                                onKeyDown={(e) => e.key === 'Enter' && updatePreview(preview.id, 'suggested_age', parseInt(e.target.value))}
                                className="w-16 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium outline-none border border-purple-400"
                              />
                            ) : (
                              <button
                                onClick={() => setEditingPreview({ id: preview.id, field: 'suggested_age' })}
                                className="px-2 py-1 bg-purple-50 text-purple-600 rounded text-xs font-medium hover:bg-purple-100 transition"
                              >
                                {preview.suggested_age} yrs
                              </button>
                            )}

                            {/* Gender - editable */}
                            {editingPreview?.id === preview.id && editingPreview?.field === 'suggested_gender' ? (
                              <select
                                defaultValue={preview.suggested_gender}
                                autoFocus
                                onChange={(e) => updatePreview(preview.id, 'suggested_gender', e.target.value)}
                                onBlur={() => setEditingPreview(null)}
                                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium outline-none border border-blue-400"
                              >
                                <option value="male">male</option>
                                <option value="female">female</option>
                              </select>
                            ) : (
                              <button
                                onClick={() => setEditingPreview({ id: preview.id, field: 'suggested_gender' })}
                                className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium hover:bg-blue-100 transition"
                              >
                                {preview.suggested_gender}
                              </button>
                            )}

                            {/* City - editable */}
                            {editingPreview?.id === preview.id && editingPreview?.field === 'suggested_city' ? (
                              <input
                                type="text"
                                defaultValue={preview.suggested_city}
                                autoFocus
                                onBlur={(e) => updatePreview(preview.id, 'suggested_city', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && updatePreview(preview.id, 'suggested_city', e.target.value)}
                                className="w-24 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium outline-none border border-green-400"
                              />
                            ) : (
                              <button
                                onClick={() => setEditingPreview({ id: preview.id, field: 'suggested_city' })}
                                className="px-2 py-1 bg-green-50 text-green-600 rounded text-xs font-medium hover:bg-green-100 transition"
                              >
                                {preview.suggested_city}
                              </button>
                            )}

                            {/* Location type - editable */}
                            {preview.location_type && (
                              editingPreview?.id === preview.id && editingPreview?.field === 'location_type' ? (
                                <select
                                  defaultValue={preview.location_type}
                                  autoFocus
                                  onChange={(e) => updatePreview(preview.id, 'location_type', e.target.value)}
                                  onBlur={() => setEditingPreview(null)}
                                  className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium outline-none border border-amber-400"
                                >
                                  <option value="urban">urban</option>
                                  <option value="suburban">suburban</option>
                                  <option value="smallTown">small town</option>
                                  <option value="rural">rural</option>
                                </select>
                              ) : (
                                <button
                                  onClick={() => setEditingPreview({ id: preview.id, field: 'location_type' })}
                                  className="px-2 py-1 bg-amber-50 text-amber-600 rounded text-xs font-medium hover:bg-amber-100 transition"
                                >
                                  {preview.location_type}
                                </button>
                              )
                            )}

                            {/* Family situation - editable */}
                            {preview.family_situation && (
                              editingPreview?.id === preview.id && editingPreview?.field === 'family_situation' ? (
                                <input
                                  type="text"
                                  defaultValue={preview.family_situation}
                                  autoFocus
                                  onBlur={(e) => updatePreview(preview.id, 'family_situation', e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && updatePreview(preview.id, 'family_situation', e.target.value)}
                                  className="flex-1 min-w-32 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs outline-none border border-gray-300"
                                />
                              ) : (
                                <button
                                  onClick={() => setEditingPreview({ id: preview.id, field: 'family_situation' })}
                                  className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 transition"
                                >
                                  {preview.family_situation}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Preview Actions */}
                <div className="flex justify-between gap-3">
                  <button
                    onClick={() => setBuilderStep('configure')}
                    className="px-6 py-2 text-gray-500 hover:text-gray-900 transition"
                  >
                    Back
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">
                      {selectedPreviews.length} persona{selectedPreviews.length !== 1 ? 's' : ''} selected
                    </span>
                    <button
                      onClick={generateFullPersonas}
                      disabled={selectedPreviews.length === 0 || generatingFull}
                      className="px-6 py-2 bg-primary hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition flex items-center gap-2"
                    >
                      {generatingFull ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          {generationProgress.total > 0
                            ? `Generating... ${generationProgress.completed}/${generationProgress.total}${generationProgress.failed > 0 ? ` (${generationProgress.failed} failed)` : ''}`
                            : 'Dispatching...'
                          }
                        </>
                      ) : (
                        'Generate Full Personas'
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>
        )}
      </main>
    </div>
  );
}
