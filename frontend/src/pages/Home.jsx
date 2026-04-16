import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import heroImg from "../assets/hero.jpg";
import "../styles/Home.css";

const API_URL = "http://localhost:3000";

export default function Home() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState({ city: "", check_in: "", check_out: "", num_rooms: "" });
  const [validationError, setValidationError] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_URL}/catalog/properties`)
      .then(({ data }) => setProperties(Array.isArray(data) ? data : []))
      .catch(() => setProperties([]))
      .finally(() => setLoading(false));
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    if (!Object.values(search).some(v => v !== "")) {
      setValidationError(true);
      return;
    }
    setValidationError(false);
    const params = new URLSearchParams();
    if (search.city)      params.set("city",      search.city);
    if (search.check_in)  params.set("check_in",  search.check_in);
    if (search.check_out) params.set("check_out", search.check_out);
    if (search.num_rooms) params.set("num_rooms", search.num_rooms);
    navigate(`/search?${params.toString()}`);
  }

  return (
    <div className="home-page">

      {/* ── Hero ── */}
      <section className="home-hero" style={{ backgroundImage: `url(${heroImg})` }}>
        <span className="home-hero-label">Locations de qualité</span>
        <h1 className="home-hero-title">
          Des logements inoubliables,<br />
          partout où vous allez.
        </h1>
        <p className="home-hero-sub">
          Trouvez l'endroit parfait pour votre prochain séjour — appartements, maisons, studios.
        </p>

        <div className="home-search-wrapper">
        <form className="home-search-bar" onSubmit={handleSearch}>
          <div className="home-search-field">
            <span className="home-search-field-label">
              <PinIcon /> Ville ou destination
            </span>
            <input
              className="home-search-input"
              type="text"
              placeholder="Paris, Lyon..."
              value={search.city}
              onChange={e => setSearch(s => ({ ...s, city: e.target.value }))}
            />
          </div>

          <div className="home-search-divider" />

          <div className="home-search-field">
            <span className="home-search-field-label">
              <CalendarIcon /> Départ
            </span>
            <input
              className="home-search-input"
              type="date"
              value={search.check_in}
              onChange={e => setSearch(s => ({ ...s, check_in: e.target.value }))}
            />
          </div>

          <div className="home-search-divider" />

          <div className="home-search-field">
            <span className="home-search-field-label">
              <CalendarIcon /> Arrivée
            </span>
            <input
              className="home-search-input"
              type="date"
              value={search.check_out}
              onChange={e => setSearch(s => ({ ...s, check_out: e.target.value }))}
            />
          </div>

          <div className="home-search-divider" />

          <div className="home-search-field">
            <span className="home-search-field-label">
              <RoomsIcon /> Chambres
            </span>
            <input
              className="home-search-input"
              type="number"
              min="1"
              placeholder="1"
              value={search.num_rooms}
              onChange={e => setSearch(s => ({ ...s, num_rooms: e.target.value }))}
            />
          </div>

          <button type="submit" className="home-search-btn">
            <SearchIcon />
          </button>
        </form>
        {validationError && (
          <p className="home-search-validation">
            Veuillez renseigner au moins un champ pour lancer la recherche.
          </p>
        )}
        </div>
      </section>

      <section className="home-listings">
        <div className="home-listings-header">
          <h2 className="home-section-title">Annonces récentes</h2>
          <Link to="/search" className="home-see-all">Voir tout →</Link>
        </div>

        {loading ? (
          <div className="home-state">Chargement...</div>
        ) : properties.length === 0 ? (
          <div className="home-state">Aucune annonce disponible pour le moment.</div>
        ) : (
          <div className="home-grid">
            {properties.map((p) => (
              <Link key={p.id} to={`/properties/${p.id}`} className="home-card">
                <div className="home-card-image">
                  <span className="home-card-image-icon">🏠</span>
                  <span className="home-card-price-badge">
                    {parseFloat(p.price_per_night).toFixed(0)} € <span>/nuit</span>
                  </span>
                </div>
                <div className="home-card-body">
                  <p className="home-card-title">{p.title}</p>
                  <div className="home-card-meta">
                    <span className="home-card-city">{p.city}</span>
                    {p.num_rooms != null && (
                      <span className="home-card-rooms">{p.num_rooms} ch.</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5"/>
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function RoomsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}
