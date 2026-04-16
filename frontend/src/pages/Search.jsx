import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Map from '../components/Map'
import '../styles/Search.css'

const API = 'http://localhost:3000'

function paramsFromURL(searchParams) {
  const params = {}
  searchParams.forEach((v, k) => {
    if (k === 'amenities') return
    if (v) params[k] = v
  })
  const amenities = searchParams.getAll('amenities')
  if (amenities.length > 0) params.amenities = amenities
  return params
}

function filtersFromURL(searchParams) {
  return {
    keyword:   searchParams.get('keyword')   || '',
    city:      searchParams.get('city')      || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
    num_rooms: searchParams.get('num_rooms') || '',
    check_in:  searchParams.get('check_in')  || '',
    check_out: searchParams.get('check_out') || '',
  }
}

function hasAtLeastOneFilter(filters, amenities) {
  return Object.values(filters).some(v => v !== '') || amenities.length > 0
}

export default function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters]           = useState(() => filtersFromURL(searchParams))
  const [amenities, setAmenities]       = useState(() => searchParams.getAll('amenities'))
  const [amenityOptions, setAmenityOptions] = useState([])
  const [results, setResults]           = useState([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)
  const [validationError, setValidationError] = useState(false)
  const [searched, setSearched]         = useState(false)
  const [selectedId, setSelectedId]     = useState(null)
  const [filtersOpen, setFiltersOpen]   = useState(false)

  const suppressEffect = useRef(false)
  const filterPanelRef = useRef(null)

  useEffect(() => {
    axios.get(`${API}/search/amenities`).then(r => setAmenityOptions(r.data))
  }, [])

  useEffect(() => {
    if (suppressEffect.current) {
      suppressEffect.current = false
      return
    }
    const params = paramsFromURL(searchParams)
    if (Object.keys(params).length === 0) return
    setFilters(filtersFromURL(searchParams))
    setAmenities(searchParams.getAll('amenities'))
    doSearch(params)
  }, [searchParams])

  // Fermer le panel au clic extérieur
  useEffect(() => {
    function handleClickOutside(e) {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target)) {
        setFiltersOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function doSearch(params) {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => {
        if (Array.isArray(v)) v.forEach(item => qs.append(k, item))
        else if (v !== undefined && v !== '') qs.set(k, v)
      })
      const { data } = await axios.get(`${API}/search?${qs.toString()}`)
      setResults(data)
      setSearched(true)
    } catch {
      setError('Erreur lors de la recherche.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = e =>
    setFilters(f => ({ ...f, [e.target.name]: e.target.value }))

  const toggleAmenity = value =>
    setAmenities(prev =>
      prev.includes(value) ? prev.filter(a => a !== value) : [...prev, value]
    )

  const handleSubmit = e => {
    e.preventDefault()
    if (!hasAtLeastOneFilter(filters, amenities)) {
      setValidationError(true)
      return
    }
    setValidationError(false)
    setFiltersOpen(false)

    const params = {}
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v })
    if (amenities.length > 0) params.amenities = amenities

    const urlParams = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v) urlParams.set(k, v) })
    amenities.forEach(a => urlParams.append('amenities', a))
    suppressEffect.current = true
    setSearchParams(urlParams)
    doSearch(params)
  }

  // Nombre de filtres avancés actifs (hors keyword/city)
  const advancedCount = [
    filters.min_price, filters.max_price, filters.num_rooms,
    filters.check_in, filters.check_out,
  ].filter(Boolean).length + amenities.length

  return (
    <div className="search-page">

      {/* ── Barre de recherche ── */}
      <form className="search-bar" onSubmit={handleSubmit}>
        <div className="search-bar-main">

          <div className="search-bar-field">
            <SearchIcon />
            <input
              name="keyword"
              type="text"
              placeholder="Mot-clé, titre..."
              value={filters.keyword}
              onChange={e => { handleChange(e); setValidationError(false) }}
            />
          </div>

          <div className="search-bar-divider" />

          <div className="search-bar-field">
            <PinIcon />
            <input
              name="city"
              type="text"
              placeholder="Ville..."
              value={filters.city}
              onChange={e => { handleChange(e); setValidationError(false) }}
            />
          </div>

          <div ref={filterPanelRef} className="search-bar-filters-wrapper">
            <button
              type="button"
              className={`search-filters-btn${filtersOpen ? ' search-filters-btn--open' : ''}`}
              onClick={() => setFiltersOpen(o => !o)}
            >
              <FiltersIcon />
              Filtres
              {advancedCount > 0 && (
                <span className="search-filters-badge">{advancedCount}</span>
              )}
            </button>

            {filtersOpen && (
              <div className="search-filters-panel">
                <div className="search-filters-row">
                  <div className="search-filter-group">
                    <label className="search-filter-label">Prix / nuit</label>
                    <div className="search-filter-range">
                      <input name="min_price" type="number" placeholder="Min €"
                        value={filters.min_price} onChange={handleChange} />
                      <span>–</span>
                      <input name="max_price" type="number" placeholder="Max €"
                        value={filters.max_price} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="search-filter-group">
                    <label className="search-filter-label">Chambres min</label>
                    <input name="num_rooms" type="number" placeholder="1"
                      min="1" value={filters.num_rooms} onChange={handleChange} />
                  </div>
                  <div className="search-filter-group">
                    <label className="search-filter-label">Départ</label>
                    <input name="check_in" type="date"
                      value={filters.check_in} onChange={handleChange} />
                  </div>
                  <div className="search-filter-group">
                    <label className="search-filter-label">Arrivée</label>
                    <input name="check_out" type="date"
                      value={filters.check_out} onChange={handleChange} />
                  </div>
                </div>

                <div className="search-filter-amenities">
                  <label className="search-filter-label">Équipements</label>
                  <div className="search-amenity-chips">
                    {amenityOptions.map(a => (
                      <button
                        key={a.value}
                        type="button"
                        className={`amenity-chip${amenities.includes(a.value) ? ' amenity-chip--active' : ''}`}
                        onClick={() => toggleAmenity(a.value)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button type="submit" className="search-submit-btn" disabled={loading}>
            {loading ? '...' : 'Rechercher'}
          </button>
        </div>

        {validationError && (
          <p className="search-validation-error">
            Veuillez renseigner au moins un champ pour lancer la recherche.
          </p>
        )}
        {error && <p className="search-validation-error">{error}</p>}
      </form>

      {/* ── Contenu ── */}
      <div className="search-content">
        <div className="search-sidebar">
          <div className="search-sidebar-header">
            <h2 className="search-sidebar-title">
              {searched ? 'Résultats' : 'Recherchez un logement'}
            </h2>
            {searched && (
              <p className="search-count">
                {results.length} logement{results.length !== 1 ? 's' : ''} trouvé{results.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="search-cards-list">
            {results.map(p => (
              <div
                key={p.id}
                className={`search-card${selectedId === p.id ? ' search-card--selected' : ''}`}
                onClick={() => {
                  setSelectedId(p.id);
                  navigate(`/properties/${p.id}`);
                }}
              >
                <div className="search-card-image">🏠</div>
                <div className="search-card-body">
                  <span className="search-card-title">{p.title}</span>
                  <span className="search-card-city">{p.city} · {p.address}</span>
                  <div className="search-card-badges">
                    {p.num_rooms && (
                      <span className="search-card-badge">🛏 {p.num_rooms} ch.</span>
                    )}
                    {p.amenities && p.amenities.split(',').slice(0, 3).map(a => (
                      <span key={a} className="search-card-badge">{a.trim()}</span>
                    ))}
                  </div>
                  <div className="search-card-footer">
                    <span className="search-card-price">
                      {parseFloat(p.price_per_night).toFixed(0)} €
                      <span className="search-card-price-unit"> / nuit</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {searched && results.length === 0 && !loading && (
              <p className="search-empty">Aucun logement trouvé.</p>
            )}
          </div>
        </div>

        <div className="search-map">
          <Map properties={results} selectedId={selectedId} />
        </div>
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5"/>
    </svg>
  )
}

function FiltersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
      <line x1="11" y1="18" x2="13" y2="18"/>
    </svg>
  )
}
