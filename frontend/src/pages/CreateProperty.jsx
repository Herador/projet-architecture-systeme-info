import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "../styles/CreateProperty.css";

const API_URL = "http://localhost:3000";

const REQUIRED = ["title", "city", "address", "price_per_night", "num_rooms", "description"];

export default function CreateProperty() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "", description: "", city: "", address: "",
    price_per_night: "", num_rooms: "",
  });
  const [amenityOptions, setAmenityOptions] = useState([]);
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/search/amenities`).then(r => setAmenityOptions(r.data));
  }, []);

  if (!user || user.role !== "owner") {
    return <p className="cp-access-denied">Accès réservé aux propriétaires.</p>;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
  }

  function toggleAmenity(value) {
    setSelectedAmenities(prev =>
      prev.includes(value) ? prev.filter(a => a !== value) : [...prev, value]
    );
  }

  function validate() {
    const newErrors = {};
    REQUIRED.forEach(field => {
      if (!form[field] || String(form[field]).trim() === "") {
        newErrors[field] = "Ce champ est obligatoire.";
      }
    });
    if (form.price_per_night && parseFloat(form.price_per_night) <= 0) {
      newErrors.price_per_night = "Le prix doit être supérieur à 0.";
    }
    if (form.num_rooms && parseInt(form.num_rooms) <= 0) {
      newErrors.num_rooms = "Le nombre de chambres doit être supérieur à 0.";
    }
    return newErrors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError("");

    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        ...form,
        price_per_night: parseFloat(form.price_per_night),
        num_rooms: parseInt(form.num_rooms),
        amenities: selectedAmenities.join(","),
      };
      await axios.post(`${API_URL}/catalog/properties`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate("/my-properties");
    } catch (err) {
      setSubmitError(err.response?.data?.detail || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="cp-page">
      <div className="cp-card">
        <h1 className="cp-title">Créer une annonce</h1>
        <p className="cp-subtitle">Tous les champs sont obligatoires</p>

        <form onSubmit={handleSubmit} className="cp-form" noValidate>

          {/* Titre */}
          <Field label="Titre de l'annonce" error={errors.title}>
            <input
              className="cp-input"
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Ex : Appartement lumineux au cœur de Paris"
            />
          </Field>

          {/* Ville + Adresse */}
          <div className="cp-row">
            <Field label="Ville" error={errors.city}>
              <input className="cp-input" type="text" name="city"
                value={form.city} onChange={handleChange} placeholder="Paris" />
            </Field>
            <Field label="Adresse" error={errors.address}>
              <input className="cp-input" type="text" name="address"
                value={form.address} onChange={handleChange} placeholder="12 rue de Rivoli" />
            </Field>
          </div>

          {/* Prix + Chambres */}
          <div className="cp-row">
            <Field label="Prix / nuit (€)" error={errors.price_per_night}>
              <input className="cp-input" type="number" name="price_per_night"
                value={form.price_per_night} onChange={handleChange}
                placeholder="80" min="1" />
            </Field>
            <Field label="Chambres" error={errors.num_rooms}>
              <input className="cp-input" type="number" name="num_rooms"
                value={form.num_rooms} onChange={handleChange}
                placeholder="2" min="1" />
            </Field>
          </div>

          {/* Description */}
          <Field label="Description" error={errors.description}>
            <textarea
              className="cp-input cp-textarea"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Décrivez votre bien, son environnement, ses points forts..."
            />
          </Field>

          {/* Équipements */}
          <div className="cp-field">
            <span className="cp-label">Équipements</span>
            <div className="cp-amenities">
              {amenityOptions.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleAmenity(value)}
                  className={`cp-amenity-chip${selectedAmenities.includes(value) ? " cp-amenity-chip--active" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {submitError && <p className="cp-error">{submitError}</p>}

          <button type="submit" className="cp-submit" disabled={loading}>
            {loading ? "Publication..." : "Publier l'annonce"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div className={`cp-field${error ? " cp-field--error" : ""}`}>
      <label className="cp-label">{label}</label>
      {children}
      {error && <span className="cp-field-error">{error}</span>}
    </div>
  );
}
