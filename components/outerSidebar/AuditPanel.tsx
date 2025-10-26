"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { fetchAuditEntries } from '@/app/actions/auditActions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface AuditPanelProps {
  isVisible: boolean
  onToggle: () => void
}

export const AuditPanel: React.FC<AuditPanelProps> = ({ isVisible, onToggle }) => {
  const [tableName, setTableName] = useState('')
  const [recordId, setRecordId] = useState('')
  const [userId, setUserId] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 50

  const load = async () => {
    setLoading(true)
    const res = await fetchAuditEntries({ tableName, recordId, userId, limit, offset })
    if (res.success) {
      setRows(res.data || [])
      setTotal(res.total || 0)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isVisible) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, offset])

  const pageInfo = useMemo(() => {
    const start = offset + 1
    const end = Math.min(offset + limit, total)
    return `${start}-${end} of ${total}`
  }, [offset, total])

  return (
    <div
      className={`fixed right-4 top-4 transition-all duration-300 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'}`}
      style={{ width: 420, height: 'calc(100vh - 32px)', zIndex: 10000000 }}
    >
      <Card className="bg-gray-900 text-gray-100 border-2 border-gray-700 h-full flex flex-col">
        <CardHeader className="pb-3 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Audit Log</CardTitle>
            <Button variant="ghost" size="sm" onClick={onToggle} className="p-1 text-gray-400 hover:text-gray-200">✕</Button>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <Input placeholder="table_name" value={tableName} onChange={e => setTableName(e.target.value)} />
            <Input placeholder="record_id" value={recordId} onChange={e => setRecordId(e.target.value)} />
            <Input placeholder="user_id" value={userId} onChange={e => setUserId(e.target.value)} />
          </div>
          <div className="flex gap-2 mt-2 items-center">
            <Button size="sm" onClick={() => { setOffset(0); load() }} disabled={loading}>Search</Button>
            <div className="text-xs text-gray-400 ml-auto">{pageInfo}</div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-800">
              <tr className="text-left">
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Table</th>
                <th className="px-3 py-2">Record</th>
                <th className="px-3 py-2">Column</th>
                <th className="px-3 py-2">New</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-gray-800">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.table_name}</td>
                  <td className="px-3 py-2">{r.record_id || ''}</td>
                  <td className="px-3 py-2">{r.column_name}</td>
                  <td className="px-3 py-2 truncate">{typeof r.new_value === 'object' ? JSON.stringify(r.new_value) : String(r.new_value)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={5}>{loading ? 'Loading…' : 'No results'}</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
        <div className="p-2 border-t border-gray-700 flex gap-2 justify-between">
          <Button size="sm" variant="ghost" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}>Prev</Button>
          <Button size="sm" variant="ghost" disabled={offset + limit >= total || loading} onClick={() => setOffset(offset + limit)}>Next</Button>
        </div>
      </Card>
    </div>
  )
}






















































