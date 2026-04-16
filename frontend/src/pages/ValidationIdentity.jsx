import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/ValidationIdentity.css";

export default function ValidationIdentity() {
  const { user, becomeOwner } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <div className="valident-page">
        <p className="valident-empty">Vous devez être connecté pour accéder à cette page.</p>
      </div>
    );
  }

  if (user.role === "owner") {
    return (
      <div className="valident-page">
        <div className="valident-card">
          <div className="valident-already-owner">
            <CheckCircleIcon />
            <h2>Vous êtes déjà propriétaire</h2>
            <p>Votre identité a déjà été vérifiée.</p>
            <button className="valident-btn-primary" onClick={() => navigate("/")}>
              Retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!phone.trim()) {
      setError("Veuillez renseigner votre numéro de téléphone.");
      return;
    }
    if (!document) {
      setError("Veuillez ajouter un document d'identité.");
      return;
    }

    setLoading(true);
    try {
      // Simulate identity verification processing
      await new Promise((resolve) => setTimeout(resolve, 2800));
      await becomeOwner();
      setSuccess(true);
      setTimeout(() => navigate("/"), 2500);
    } catch (err) {
      setError(err.response?.data?.detail || "Une erreur est survenue lors de la vérification.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="valident-page">
        <div className="valident-card">
          <div className="valident-success">
            <div className="valident-success-icon">
              <CheckCircleIcon />
            </div>
            <h2 className="valident-success-title">Identité vérifiée !</h2>
            <p className="valident-success-text">
              Félicitations, vous êtes maintenant propriétaire. Vous allez être redirigé vers l'accueil…
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="valident-page">
      <div className="valident-card">
        <div className="valident-header">
          <div className="valident-icon">
            <ShieldIcon />
          </div>
          <h1 className="valident-title">Vérification d'identité</h1>
          <p className="valident-subtitle">
            Pour devenir propriétaire, nous avons besoin de vérifier votre identité.
            Remplissez les informations ci-dessous.
          </p>
        </div>

        <form className="valident-form" onSubmit={handleSubmit}>
          <div className="valident-field">
            <label className="valident-label" htmlFor="email">
              Adresse e-mail
            </label>
            <input
              id="email"
              className="valident-input valident-input--readonly"
              type="email"
              value={user.email || user.username}
              readOnly
            />
            <span className="valident-hint">Prérempli depuis votre compte</span>
          </div>

          <div className="valident-field">
            <label className="valident-label" htmlFor="phone">
              Numéro de téléphone <span className="valident-required">*</span>
            </label>
            <input
              id="phone"
              className="valident-input"
              type="tel"
              placeholder="+33 6 00 00 00 00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="valident-field">
            <label className="valident-label" htmlFor="document">
              Document d'identité <span className="valident-required">*</span>
            </label>
            <div className={`valident-upload ${document ? "valident-upload--filled" : ""}`}>
              <input
                id="document"
                className="valident-upload-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={loading}
                onChange={(e) => setDocument(e.target.files[0] || null)}
              />
              <label htmlFor="document" className="valident-upload-label">
                {document ? (
                  <>
                    <FileCheckIcon />
                    <span>{document.name}</span>
                  </>
                ) : (
                  <>
                    <UploadIcon />
                    <span>Cliquez pour ajouter un fichier</span>
                    <span className="valident-upload-hint">PDF, JPG ou PNG — max 10 Mo</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {error && <p className="valident-error">{error}</p>}

          <button
            className="valident-btn-primary"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <span className="valident-btn-loading">
                <Spinner />
                Vérification en cours…
              </span>
            ) : (
              "Valider mon identité"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      width="24" height="24">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function FileCheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      width="20" height="20">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="15" x2="15" y2="15" />
      <line x1="9" y1="11" x2="15" y2="11" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="valident-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="valident-spinner-track" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="valident-spinner-arc" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
