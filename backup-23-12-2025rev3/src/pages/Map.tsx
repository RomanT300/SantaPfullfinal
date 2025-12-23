import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import type { LatLngExpression, LatLngBoundsExpression } from 'leaflet'
import type { FC } from 'react'

type Plant = {
  id: string
  name: string
  latitude: number
  longitude: number
  status: string
}

export default function MapPage() {
  const [plants, setPlants] = useState<Plant[]>([])
  const [adding, setAdding] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newPlant, setNewPlant] = useState<{ name: string; location: string; latitude: number | null; longitude: number | null; status: string }>({
    name: '',
    location: '',
    latitude: null,
    longitude: null,
    status: 'active',
  })
  const [notice, setNotice] = useState<string | null>(null)
  const mapCenter: LatLngExpression = [-1.8, -78.5]
  const ecuadorBounds: LatLngBoundsExpression = [[-5.0, -81.3], [1.5, -75.0]]
  const RLMapContainer: FC<any> = MapContainer as unknown as FC<any>
  useEffect(() => {
    fetch('/api/plants', { credentials: 'include' })
      .then(r => r.json())
      .then(json => { if (json.success) setPlants(json.data || []) })
      .catch(() => {})
    // Detectar rol admin
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (res.ok) {
          const json = await res.json()
          setIsAdmin((json?.user?.role) === 'admin')
        }
      } catch (_) {}
    })()
  }, [])

  function ClickSetter({ enabled }: { enabled: boolean }) {
    useMapEvents({
      click(e) {
        if (!enabled) return
        setNewPlant(p => ({ ...p, latitude: e.latlng.lat, longitude: e.latlng.lng }))
      },
    })
    return null
  }

  const savePlant = async () => {
    setNotice(null)
    if (!newPlant.name || newPlant.latitude == null || newPlant.longitude == null) {
      setNotice('Completa nombre y selecciona coordenadas haciendo clic en el mapa.')
      return
    }
    try {
      const payload = {
        name: newPlant.name,
        location: newPlant.location || `${newPlant.latitude}, ${newPlant.longitude}`,
        latitude: newPlant.latitude,
        longitude: newPlant.longitude,
        status: newPlant.status,
      }
      const isUpdate = Boolean(editingId)
      const url = isUpdate ? `/api/plants/${editingId}` : '/api/plants'
      const method = isUpdate ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error')
      if (isUpdate) {
        setPlants(prev => prev.map(p => (p.id === editingId ? json.data : p)))
      } else {
        setPlants(prev => [...prev, json.data])
      }
      setAdding(false)
      setEditingId(null)
      setNewPlant({ name: '', location: '', latitude: null, longitude: null, status: 'active' })
      setNotice(isUpdate ? 'Planta actualizada correctamente.' : 'Planta guardada correctamente.')
    } catch (e: any) {
      // Fallback: mostrar marcador local si el backend no guarda
      const localPlant: Plant = {
        id: editingId ? editingId : `local-${Date.now()}`,
        name: `${newPlant.name} (local)`,
        latitude: newPlant.latitude!,
        longitude: newPlant.longitude!,
        status: 'sincronizar',
      }
      if (editingId) {
        setPlants(prev => prev.map(p => (p.id === editingId ? localPlant : p)))
      } else {
        setPlants(prev => [...prev, localPlant])
      }
      setAdding(false)
      setEditingId(null)
      setNotice(editingId ? 'No se pudo actualizar en el backend. Actualización local aplicada.' : 'No se pudo guardar en el backend. Marcador local añadido.')
    }
  }

  const startEdit = (plant: Plant) => {
    if (!isAdmin) return
    setEditingId(plant.id)
    setNewPlant({
      name: plant.name,
      location: '',
      latitude: plant.latitude,
      longitude: plant.longitude,
      status: plant.status,
    })
    setAdding(true)
  }

  const deletePlant = async (id: string) => {
    if (!isAdmin) return
    setNotice(null)
    if (!confirm('¿Eliminar esta planta?')) return
    try {
      const res = await fetch(`/api/plants/${id}`, { method: 'DELETE', credentials: 'include' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error')
      setPlants(prev => prev.filter(p => p.id !== id))
      setNotice('Planta eliminada correctamente.')
    } catch (e: any) {
      setPlants(prev => prev.filter(p => p.id !== id))
      setNotice('No se pudo eliminar en el backend. Eliminación local aplicada.')
    }
  }

  return (
    <div className="h-[calc(100vh-64px)] relative">
      {/* Panel de edición */}
      <div className="absolute top-3 left-3 z-[1000] bg-white dark:bg-gray-800 rounded border shadow p-3 w-80">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Mapa de Plantas</div>
          {isAdmin ? (
            <label className="text-sm flex items-center gap-1">
              <input type="checkbox" checked={adding} onChange={e=>setAdding(e.target.checked)} />
              Modo edición {editingId ? '(actualizando)' : ''}
            </label>
          ) : (
            <span className="text-xs text-gray-500">Solo admin puede editar</span>
          )}
        </div>
        {adding && (
          <div className="space-y-2">
            <input className="w-full px-2 py-1 rounded border" placeholder="Nombre de planta" value={newPlant.name} onChange={e=>setNewPlant(p=>({...p, name: e.target.value}))} />
            <input className="w-full px-2 py-1 rounded border" placeholder="Ubicación (opcional)" value={newPlant.location} onChange={e=>setNewPlant(p=>({...p, location: e.target.value}))} />
            <div className="text-xs text-gray-600">Haz clic en el mapa para fijar coordenadas.</div>
            <div className="grid grid-cols-2 gap-2">
              <input className="px-2 py-1 rounded border" placeholder="Latitud" value={newPlant.latitude ?? ''} onChange={e=>setNewPlant(p=>({...p, latitude: Number(e.target.value)}))} />
              <input className="px-2 py-1 rounded border" placeholder="Longitud" value={newPlant.longitude ?? ''} onChange={e=>setNewPlant(p=>({...p, longitude: Number(e.target.value)}))} />
            </div>
            <button className="px-3 py-1 rounded border bg-blue-600 text-white" onClick={savePlant}>Guardar</button>
          </div>
        )}
        {notice && <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">{notice}</div>}
      </div>
      {/* Limitar navegación a Ecuador continental (solo Ecuador visible) */}
      <RLMapContainer
        center={mapCenter}
        zoom={7}
        minZoom={6}
        maxZoom={14}
        maxBounds={ecuadorBounds}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickSetter enabled={adding} />
        {plants.map(p => (
          <Marker key={p.id} position={[p.latitude, p.longitude]}>
            <Popup>
              <div className="min-w-48">
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-gray-500">Estado: {p.status}</div>
                <a className="text-blue-600 text-sm" href={`/documents?plant=${p.id}`}>Ver documentos</a>
                {isAdmin && (
                  <div className="mt-2 flex gap-2">
                    <button className="px-2 py-1 text-xs rounded border bg-yellow-600 text-white" onClick={()=>startEdit(p)}>Editar</button>
                    <button className="px-2 py-1 text-xs rounded border bg-red-600 text-white" onClick={()=>deletePlant(p.id)}>Eliminar</button>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </RLMapContainer>
    </div>
  )
}