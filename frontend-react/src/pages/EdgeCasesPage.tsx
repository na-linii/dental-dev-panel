import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { edgeCasesApi, clinicsApi, langfuseApi } from '../api/client'
import { EdgeCaseCard } from '../components/EdgeCaseCard'

export function EdgeCasesPage() {
  const [clinicId, setClinicId] = useState('zubatka')

  const { data: clinics } = useQuery({
    queryKey: ['clinics'],
    queryFn: clinicsApi.list,
  })

  const { data: edgeCasesData, isLoading, error } = useQuery({
    queryKey: ['edge-cases'],
    queryFn: edgeCasesApi.list,
  })

  const { data: lfUrl } = useQuery({
    queryKey: ['langfuse-url'],
    queryFn: langfuseApi.url,
  })

  const items = edgeCasesData?.items ?? []
  const langfuseUrl = lfUrl ?? ''

  // Group by category
  const categories: Record<string, typeof items> = {}
  items.forEach((item) => {
    const cat = item.category || 'other'
    if (!categories[cat]) categories[cat] = []
    categories[cat].push(item)
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold mb-0.5">Edge Cases</h2>
          <p className="text-xs text-[#64748b]">
            Test scenarios from Langfuse dataset. Click to expand, Run to test.
          </p>
        </div>
        <div className="flex gap-1.5">
          <select
            value={clinicId}
            onChange={(e) => setClinicId(e.target.value)}
            className="text-xs px-2 py-1 bg-[#111127] text-white border border-[#1e293b] rounded"
          >
            {clinics?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            )) ?? <option value="zubatka">Зубатка</option>}
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="text-[#64748b] text-sm">Loading from Langfuse dataset...</div>
      )}

      {error && (
        <div className="text-[#f87171] text-sm">
          Failed to load edge cases: {(error as Error).message}
        </div>
      )}

      {edgeCasesData?.error && (
        <div className="text-[#facc15] text-sm">{edgeCasesData.error}</div>
      )}

      {Object.entries(categories).map(([cat, caseItems]) => (
        <div key={cat} className="mb-4">
          <h3 className="text-xs text-[#7dd3fc] font-semibold mb-1.5">{cat}</h3>
          {caseItems.map((item) => (
            <EdgeCaseCard
              key={item.id}
              item={item}
              clinicId={clinicId}
              langfuseUrl={langfuseUrl}
            />
          ))}
        </div>
      ))}

      {!isLoading && items.length === 0 && !error && (
        <div className="text-[#64748b] text-sm">
          Dataset empty. Run: <code className="text-xs bg-[#1e293b] px-1 rounded">python scripts/run_eval.py --seed-only</code>
        </div>
      )}
    </div>
  )
}
