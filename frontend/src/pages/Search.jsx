import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import Map from '../components/Map'
import '../styles/Search.css'

const API = 'http://localhost:3000'

const AMENITY_OPTIONS = [
  { value: 'wifi',             label: 'WiFi' },
  { value: 'parking',          label: 'Parking' },
  { value: 'piscine',          label: 'Piscine' },
  { value: 'climatisation',    label: 'Clim' },
  { value: 'lave_linge',       label: 'Lave-linge' },
  { value: 'televiseur',       label: 'TV' },
  { value: 'cuisine_equipee',  label: 'Cuisine' },
  { value: 'animaux_acceptes', label: 'Animaux' },
]

  

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

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters]     = useState(() => filtersFromURL(searchParams))
  const [amenities, setAmenities] = useState(() => searchParams.getAll('amenities'))
  const [results, setResults]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [searched, setSearched]   = useState(false)
  const [sidebarTitle, setSidebarTitle] = useState('Recherchez un logement')
  const [selectedId, setSelectedId] = useState(null)

  const suppressEffect = useRef(false)

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

  async function doSearch(params) {
    setLoading(true)
    setSidebarTitle('Résultats de la recherche pour « ' + (params.keyword || 'tout') + ' »')
    setError(null)
    try {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          v.forEach(item => qs.append(k, item))
        } else if (v !== undefined && v !== '') {
          qs.set(k, v)
        }
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



  return (
    <div className="search-page">

      <form className="search-filters" onSubmit={handleSubmit}>

        <div className="search-filters-row">
          <div className="filter-chip-input">
            <input name="keyword" type="text" placeholder="Mot-clé..." value={filters.keyword} onChange={handleChange} />
          </div>
          <div className="filter-chip-input">
            <input name="city" type="text" placeholder="Ville..." value={filters.city} onChange={handleChange} />
          </div>
          <div className="filter-chip-input">
            <input name="min_price" type="number" placeholder="Min €" value={filters.min_price} onChange={handleChange} />
            <span className="filter-separator">–</span>
            <input name="max_price" type="number" placeholder="Max €" value={filters.max_price} onChange={handleChange} />
          </div>
          <div className="filter-chip-input">
            <input name="num_rooms" type="number" placeholder="Chambres" value={filters.num_rooms} onChange={handleChange} />
          </div>
          <div className="filter-chip-input">
            <input name="check_in"  type="date" value={filters.check_in}  onChange={handleChange} />
            <span className="filter-separator">→</span>
            <input name="check_out" type="date" value={filters.check_out} onChange={handleChange} />
          </div>
        </div>

        <div className="search-filters-row">
          {AMENITY_OPTIONS.map(a => (
            <button
              key={a.value}
              type="button"
              className={`amenity-chip${amenities.includes(a.value) ? ' amenity-chip--active' : ''}`}
              onClick={() => toggleAmenity(a.value)}
            >
              {a.label}
            </button>
          ))}
          <button type="submit" className="search-btn" disabled={loading}>
            {loading ? '...' : 'Filtrer'}
          </button>
        </div>

      </form>

      {error && <p className="search-error">{error}</p>}

      <div className="search-content">

        <div className="search-sidebar">
          <div className="search-sidebar-header">
            <h2 className="search-sidebar-title">{sidebarTitle}</h2>
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
                onClick={() => setSelectedId(p.id)}
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
                      <span key={a} className="search-card-badge">{a}</span>
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
