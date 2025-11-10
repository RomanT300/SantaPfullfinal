import React, { useEffect, useMemo, useState } from 'react';

type Emergency = {
  id: string;
  plant_id: string;
  plant_name?: string;
  reason: string;
  solved: boolean;
  resolve_time_hours?: number;
  reported_at: string; // ISO date
  severity?: 'low' | 'medium' | 'high';
  resolved_at?: string; // ISO date
  observations?: string;
};

type PlantOption = { id: string; name: string };

const Emergencies: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [plantsFallback, setPlantsFallback] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    emergencies.forEach(e => {
      const y = new Date(e.reported_at).getFullYear();
      years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [emergencies]);

  useEffect(() => {
    // role detection via /api/auth/me using HttpOnly cookie
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          setIsAdmin((json?.user?.role) === 'admin');
        }
      } catch (_) {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    const loadPlants = async () => {
      try {
        const res = await fetch('/api/plants', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load plants');
        const data = await res.json();
        const mapped: PlantOption[] = (data?.data || []).map((p: any) => ({ id: p.id, name: p.name })) || [];
        setPlants(mapped);
        setPlantsFallback(false);
        if (mapped.length && selectedPlants.length === 0) setSelectedPlants(mapped.map(p => p.id));
      } catch (err) {
        // Fallback: derivar plantas desde emergencias (cache/local) para no dejar vacío el selector
        let rows: Emergency[] = [];
        try {
          const cached = localStorage.getItem('emergencies_cache');
          if (cached) rows = JSON.parse(cached);
        } catch {}
        if (!rows || rows.length === 0) {
          try {
            const res2 = await fetch('/api/maintenance/emergencies', { credentials: 'include' });
            if (res2.ok) {
              const json2 = await res2.json();
              rows = json2?.data || [];
            }
          } catch {}
        }
        const ids = Array.from(new Set((rows || []).map(r => r.plant_id).filter(Boolean)));
        const options: PlantOption[] = ids.map(id => ({ id, name: (rows.find(r => r.plant_id === id)?.plant_name) || id }));
        if (options.length > 0) {
          setPlants(options);
          setPlantsFallback(true);
          if (selectedPlants.length === 0) setSelectedPlants(options.map(p => p.id));
        }
      }
    };
    loadPlants();
  }, []);

  useEffect(() => {
    const loadEmergencies = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/maintenance/emergencies', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load emergencies');
        const data = await res.json();
        const rows: Emergency[] = data?.data || [];
        setEmergencies(rows);
        localStorage.setItem('emergencies_cache', JSON.stringify(rows));
      } catch (err) {
        const cached = localStorage.getItem('emergencies_cache');
        if (cached) {
          setEmergencies(JSON.parse(cached));
        }
      } finally {
        setLoading(false);
      }
    };
    loadEmergencies();
  }, []);

  const filteredEmergencies = useMemo(() => {
    return emergencies.filter(e => {
      const y = new Date(e.reported_at).getFullYear();
      return y === selectedYear && (selectedPlants.length === 0 || selectedPlants.includes(e.plant_id));
    });
  }, [emergencies, selectedYear, selectedPlants]);

  const [newEm, setNewEm] = useState<{
    plant_id: string;
    reason: string;
    solved: boolean;
    resolveTimeHours?: number;
    severity?: 'low' | 'medium' | 'high';
    reportedAt?: string;
    resolvedAt?: string;
    observations?: string;
  }>({
    plant_id: '',
    reason: '',
    solved: false,
    resolveTimeHours: undefined,
    severity: undefined,
    reportedAt: undefined,
    resolvedAt: undefined,
    observations: undefined,
  });

  const createEmergency = async () => {
    if (!newEm.plant_id || !newEm.reason) return;
    try {
      const res = await fetch('/api/maintenance/emergencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          plantId: newEm.plant_id,
          reason: newEm.reason,
          solved: newEm.solved,
          resolveTimeHours: newEm.resolveTimeHours,
          severity: newEm.severity,
          reportedAt: newEm.reportedAt,
          resolvedAt: newEm.resolvedAt,
          observations: newEm.observations,
        }),
      });
      if (!res.ok) throw new Error('Failed to create emergency');
      const created = await res.json();
      const createdRow: Emergency = created?.data || created;
      setEmergencies(prev => [createdRow, ...prev]);
      setNewEm({ plant_id: '', reason: '', solved: false, resolveTimeHours: undefined, severity: undefined, reportedAt: undefined, resolvedAt: undefined, observations: undefined });
    } catch (err) {
      const tmp: Emergency = {
        id: `local-${Date.now()}`,
        plant_id: newEm.plant_id,
        plant_name: plants.find(p => p.id === newEm.plant_id)?.name,
        reason: newEm.reason,
        solved: newEm.solved,
        resolve_time_hours: newEm.resolveTimeHours,
        reported_at: newEm.reportedAt || new Date().toISOString(),
        severity: newEm.severity,
        resolved_at: newEm.resolvedAt,
        observations: newEm.observations,
      };
      setEmergencies(prev => [tmp, ...prev]);
      setNewEm({ plant_id: '', reason: '', solved: false, resolveTimeHours: undefined, severity: undefined, reportedAt: undefined, resolvedAt: undefined, observations: undefined });
      localStorage.setItem('emergencies_cache', JSON.stringify([tmp, ...emergencies]));
    }
  };

  const updateEmergency = async (id: string, patch: Partial<Emergency>) => {
    try {
      // Only send fields that are actually being updated
      const body: any = {};
      if (patch.plant_id !== undefined) body.plantId = patch.plant_id;
      if (patch.reason !== undefined) body.reason = patch.reason;
      if (patch.solved !== undefined) body.solved = patch.solved;
      if (patch.resolve_time_hours !== undefined) body.resolveTimeHours = patch.resolve_time_hours;
      if (patch.severity !== undefined) body.severity = patch.severity;
      if (patch.resolved_at !== undefined) body.resolvedAt = patch.resolved_at;
      if (patch.observations !== undefined) body.observations = patch.observations;

      const res = await fetch(`/api/maintenance/emergencies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        console.error('Update failed:', json.error);
        alert('Error al actualizar: ' + (json.error || 'Unknown error'));
        return;
      }
    } catch (err) {
      console.error('Update error:', err);
      alert('Error al actualizar emergencia');
      return;
    }

    // Update local state only after successful API call
    setEmergencies(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)));
    localStorage.setItem('emergencies_cache', JSON.stringify(emergencies.map(e => (e.id === id ? { ...e, ...patch } : e))));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Emergencias</h1>
      {plants.length === 0 && (
        <div className="mb-4 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-3">
          No hay plantas registradas. Regístralas en <a href="/admin" className="underline">Admin</a> (pestaña “Plantas”) o en el <a href="/map" className="underline">Mapa</a>.
        </div>
      )}
      {plants.length > 0 && plantsFallback && (
        <div className="mb-4 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded p-3">
          Las plantas se cargaron desde emergencias por conexión de datos limitada. Configura la BD para ver nombres reales.
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Año</label>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            {availableYears.length === 0 ? (
              <option value={selectedYear}>{selectedYear}</option>
            ) : (
              availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Plantas</label>
          <select
            multiple
            value={selectedPlants}
            onChange={e => {
              const options = Array.from(e.target.selectedOptions).map(o => o.value);
              setSelectedPlants(options);
            }}
            className="border rounded px-2 py-1 min-w-[220px] h-24"
          >
            {plants.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Formulario admin */}
  {isAdmin && (
        <div className="border rounded p-4 mb-6">
          <h2 className="text-lg font-medium mb-3">Reportar emergencia</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-sm mb-1">Planta</label>
              <select
                value={newEm.plant_id}
                onChange={e => setNewEm(s => ({ ...s, plant_id: e.target.value }))}
                className="border rounded px-2 py-1 w-full"
              >
                <option value="">Seleccione planta</option>
                {plants.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Motivo</label>
              <input
                type="text"
                value={newEm.reason}
                onChange={e => setNewEm(s => ({ ...s, reason: e.target.value }))}
                className="border rounded px-2 py-1 w-full"
                placeholder="Descripción corta"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Severidad</label>
              <select
                value={newEm.severity || ''}
                onChange={e => setNewEm(s => ({ ...s, severity: (e.target.value || undefined) as any }))}
                className="border rounded px-2 py-1 w-full"
              >
                <option value="">Sin especificar</option>
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="em_solved"
                type="checkbox"
                checked={newEm.solved}
                onChange={e => setNewEm(s => ({ ...s, solved: e.target.checked }))}
              />
              <label htmlFor="em_solved" className="text-sm">Resuelta</label>
            </div>
            <div>
              <label className="block text-sm mb-1">Tiempo resolución (h)</label>
              <input
                type="number"
                min={0}
                value={newEm.resolveTimeHours ?? ''}
                onChange={e => setNewEm(s => ({ ...s, resolveTimeHours: e.target.value ? Number(e.target.value) : undefined }))}
                className="border rounded px-2 py-1 w-full"
                placeholder="p.ej. 2"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Fecha reportada</label>
              <input
                type="datetime-local"
                value={newEm.reportedAt ? newEm.reportedAt.slice(0, 16) : ''}
                onChange={e => setNewEm(s => ({ ...s, reportedAt: e.target.value ? new Date(e.target.value).toISOString() : undefined }))}
                className="border rounded px-2 py-1 w-full"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Fecha resolución</label>
              <input
                type="datetime-local"
                value={newEm.resolvedAt ? newEm.resolvedAt.slice(0, 16) : ''}
                onChange={e => setNewEm(s => ({ ...s, resolvedAt: e.target.value ? new Date(e.target.value).toISOString() : undefined }))}
                className="border rounded px-2 py-1 w-full"
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-sm mb-1">Observaciones</label>
              <textarea
                value={newEm.observations ?? ''}
                onChange={e => setNewEm(s => ({ ...s, observations: e.target.value || undefined }))}
                className="border rounded px-2 py-1 w-full"
                rows={3}
                placeholder="Notas detalladas sobre la emergencia..."
              />
            </div>
            <div>
              <button onClick={createEmergency} className="bg-blue-600 text-white px-3 py-1 rounded">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="border rounded">
        <div className="px-4 py-2 border-b bg-gray-50 font-medium">Emergencias reportadas</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-3 py-2">Fecha reportada</th>
                <th className="px-3 py-2">Planta</th>
                <th className="px-3 py-2">Motivo</th>
                <th className="px-3 py-2">Severidad</th>
                <th className="px-3 py-2">Resuelta</th>
                <th className="px-3 py-2">Tiempo (h)</th>
                <th className="px-3 py-2">Fecha resolución</th>
                <th className="px-3 py-2">Observaciones</th>
                {isAdmin && <th className="px-3 py-2">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-3 py-2" colSpan={isAdmin ? 9 : 8}>Cargando...</td></tr>
              ) : filteredEmergencies.length === 0 ? (
                <tr><td className="px-3 py-2" colSpan={isAdmin ? 9 : 8}>Sin emergencias</td></tr>
              ) : (
                filteredEmergencies.map(e => (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2">{new Date(e.reported_at).toLocaleString()}</td>
                    <td className="px-3 py-2">
                {isAdmin ? (
                        <select
                          className="border rounded px-2 py-1"
                          value={e.plant_id}
                          onChange={ev => updateEmergency(e.id, { plant_id: ev.target.value })}
                        >
                          {plants.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      ) : (
                        e.plant_name || plants.find(p => p.id === e.plant_id)?.name || e.plant_id
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isAdmin ? (
                        <input
                          type="text"
                          className="border rounded px-2 py-1 w-64"
                          value={e.reason}
                          onChange={ev => updateEmergency(e.id, { reason: ev.target.value })}
                        />
                      ) : (
                        e.reason
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isAdmin ? (
                        <select
                          className="border rounded px-2 py-1"
                          value={e.severity || ''}
                          onChange={ev => updateEmergency(e.id, { severity: (ev.target.value || undefined) as any })}
                        >
                          <option value="">-</option>
                          <option value="low">Baja</option>
                          <option value="medium">Media</option>
                          <option value="high">Alta</option>
                        </select>
                      ) : (
                        e.severity ? (e.severity === 'low' ? 'Baja' : e.severity === 'medium' ? 'Media' : 'Alta') : '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={e.solved}
                        disabled={!isAdmin}
                        onChange={ev => updateEmergency(e.id, { solved: ev.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {isAdmin ? (
                        <input
                          type="number"
                          min={0}
                          className="border rounded px-2 py-1 w-24"
                          value={e.resolve_time_hours ?? ''}
                          onChange={ev => updateEmergency(e.id, { resolve_time_hours: ev.target.value ? Number(ev.target.value) : undefined })}
                        />
                      ) : (
                        e.resolve_time_hours ?? '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isAdmin ? (
                        <input
                          type="datetime-local"
                          className="border rounded px-2 py-1"
                          value={e.resolved_at ? e.resolved_at.slice(0, 16) : ''}
                          onChange={ev => updateEmergency(e.id, { resolved_at: ev.target.value ? new Date(ev.target.value).toISOString() : undefined })}
                        />
                      ) : (
                        e.resolved_at ? new Date(e.resolved_at).toLocaleString() : '-'
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      {isAdmin ? (
                        <textarea
                          className="border rounded px-2 py-1 w-full text-xs"
                          rows={2}
                          value={e.observations ?? ''}
                          onChange={ev => updateEmergency(e.id, { observations: ev.target.value || undefined })}
                          placeholder="Observaciones..."
                        />
                      ) : (
                        <span className="text-xs">{e.observations || '-'}</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-2">
                        <button
                          className="text-sm text-blue-600"
                          onClick={() => updateEmergency(e.id, { solved: !e.solved })}
                        >
                          Alternar
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Emergencies;