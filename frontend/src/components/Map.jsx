import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function priceMarker(price) {
  const label = `${Math.round(parseFloat(price))}€`
  return L.divIcon({
    className: '',
    html: `<div class="map-price-marker">${label}</div>`,
    iconSize:   [0, 0],
    iconAnchor: [0, 0],
  })
}

function BoundsUpdater({ properties }) {
  const map = useMap()
  useEffect(() => {
    const valid = properties.filter(p => p.latitude && p.longitude)
    if (valid.length === 0) return
    map.fitBounds(valid.map(p => [p.latitude, p.longitude]), { padding: [60, 60] })
  }, [properties, map])
  return null
}

function FocusUpdater({ properties, selectedId, markerRefs }) {
  const map = useMap()
  useEffect(() => {
    if (!selectedId) return
    const prop = properties.find(p => String(p.id) === String(selectedId))
    if (!prop?.latitude || !prop?.longitude) return

    map.flyTo([prop.latitude, prop.longitude], 13, { duration: 0.7 })

    const t = setTimeout(() => {
      markerRefs.current[selectedId]?.openPopup()
    }, 750)
    return () => clearTimeout(t)
  }, [selectedId])

  return null
}

export default function Map({ properties = [], selectedId = null }) {
  const valid = properties.filter(p => p.latitude && p.longitude)
  const markerRefs = useRef({})
  const navigate = useNavigate()

  return (
    <div className="map-wrapper">
      <MapContainer
        center={[46.6034, 1.8883]}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <BoundsUpdater properties={valid} />
        <FocusUpdater properties={valid} selectedId={selectedId} markerRefs={markerRefs} />
        {valid.map(p => (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={priceMarker(p.price_per_night)}
            ref={el => { if (el) markerRefs.current[p.id] = el }}
          >
            <Popup>
              <div className="map-popup">
                <p className="map-popup-title">{p.title}</p>
                <p className="map-popup-city">{p.city}</p>
                <p className="map-popup-price">{parseFloat(p.price_per_night).toFixed(0)} € / nuit</p>
                {p.num_rooms && (
                  <p className="map-popup-rooms">{p.num_rooms} chambre{p.num_rooms > 1 ? 's' : ''}</p>
                )}
                <button className="map-popup-btn" /*onClick={() => navigate(`/.../${p.id}`)}*/>
                  Voir les détails
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
