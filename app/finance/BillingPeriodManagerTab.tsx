'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContentGlass,
  DialogHeaderGlass,
  DialogFooterGlass,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getBillingPeriods,
  createBillingPeriod,
  updateBillingPeriod,
  deleteBillingPeriod,
  getMonthlySnapshots,
  type BillingPeriod,
  type MonthlySnapshot,
} from '@/app/actions/finance'
import { toast } from 'sonner'

interface BillingPeriodManagerTabProps {
  initialPeriods?: BillingPeriod[]
  initialSnapshots?: MonthlySnapshot[]
}

/**
 * Billing Period Manager Tab Component
 * Allows users to create, view, edit, and delete future billing periods for budgeting
 */
export default function BillingPeriodManagerTab({
  initialPeriods = [],
  initialSnapshots = [],
}: BillingPeriodManagerTabProps) {
  const [periods, setPeriods] = useState<BillingPeriod[]>(initialPeriods)
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>(initialSnapshots)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod | null>(null)
  const [editingPeriod, setEditingPeriod] = useState<BillingPeriod | null>(null)

  // Form state for create/edit
  const [formData, setFormData] = useState({
    period_name: '',
    start_date: '',
    end_date: '',
    snapshot_id: '',
    notes: '',
  })

  // Load periods and snapshots
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [periodsResult, snapshotsResult] = await Promise.all([
        getBillingPeriods(),
        getMonthlySnapshots(),
      ])

      if (periodsResult.error) {
        toast.error(`Failed to load periods: ${periodsResult.error}`)
      } else if (periodsResult.data) {
        setPeriods(periodsResult.data)
      }

      if (snapshotsResult.error) {
        console.error('Failed to load snapshots:', snapshotsResult.error)
      } else if (snapshotsResult.data) {
        setSnapshots(snapshotsResult.data)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter periods to show only future periods (or all if needed)
  const futurePeriods = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return periods.filter((period) => {
      const endDate = new Date(period.end_date)
      endDate.setHours(0, 0, 0, 0)
      return endDate >= today
    })
  }, [periods])

  // Sort periods by start date (future first)
  const sortedPeriods = useMemo(() => {
    return [...futurePeriods].sort((a, b) => {
      const dateA = new Date(a.start_date).getTime()
      const dateB = new Date(b.start_date).getTime()
      return dateA - dateB
    })
  }, [futurePeriods])

  // Reset form
  const resetForm = useCallback(() => {
    setFormData({
      period_name: '',
      start_date: '',
      end_date: '',
      snapshot_id: '',
      notes: '',
    })
  }, [])

  // Open create dialog
  const handleCreateClick = useCallback(() => {
    resetForm()
    setIsCreateDialogOpen(true)
  }, [resetForm])

  // Open edit dialog
  const handleEditClick = useCallback((period: BillingPeriod) => {
    setEditingPeriod(period)
    setFormData({
      period_name: period.period_name,
      start_date: period.start_date,
      end_date: period.end_date,
      snapshot_id: period.snapshot_id || '',
      notes: period.notes || '',
    })
    setIsEditDialogOpen(true)
  }, [])

  // Open delete confirmation
  const handleDeleteClick = useCallback((period: BillingPeriod) => {
    setSelectedPeriod(period)
    setIsDeleteDialogOpen(true)
  }, [])

  // Create period
  const handleCreate = useCallback(async () => {
    if (!formData.period_name.trim()) {
      toast.error('Period name is required')
      return
    }
    if (!formData.start_date || !formData.end_date) {
      toast.error('Start date and end date are required')
      return
    }

    const startDate = new Date(formData.start_date)
    const endDate = new Date(formData.end_date)
    if (endDate < startDate) {
      toast.error('End date must be after start date')
      return
    }

    setIsLoading(true)
    try {
      const result = await createBillingPeriod({
        period_name: formData.period_name.trim(),
        start_date: formData.start_date,
        end_date: formData.end_date,
        snapshot_id: formData.snapshot_id || null,
        notes: formData.notes.trim() || null,
      })

      if (result.error) {
        toast.error(`Failed to create period: ${result.error}`)
      } else {
        toast.success('Billing period created successfully')
        setIsCreateDialogOpen(false)
        resetForm()
        await loadData()
      }
    } catch (error) {
      console.error('Error creating period:', error)
      toast.error('Failed to create period')
    } finally {
      setIsLoading(false)
    }
  }, [formData, loadData, resetForm])

  // Update period
  const handleUpdate = useCallback(async () => {
    if (!editingPeriod) return

    if (!formData.period_name.trim()) {
      toast.error('Period name is required')
      return
    }
    if (!formData.start_date || !formData.end_date) {
      toast.error('Start date and end date are required')
      return
    }

    const startDate = new Date(formData.start_date)
    const endDate = new Date(formData.end_date)
    if (endDate < startDate) {
      toast.error('End date must be after start date')
      return
    }

    setIsLoading(true)
    try {
      const result = await updateBillingPeriod(editingPeriod.id, {
        period_name: formData.period_name.trim(),
        start_date: formData.start_date,
        end_date: formData.end_date,
        snapshot_id: formData.snapshot_id || null,
        notes: formData.notes.trim() || null,
      })

      if (result.error) {
        toast.error(`Failed to update period: ${result.error}`)
      } else {
        toast.success('Billing period updated successfully')
        setIsEditDialogOpen(false)
        setEditingPeriod(null)
        resetForm()
        await loadData()
      }
    } catch (error) {
      console.error('Error updating period:', error)
      toast.error('Failed to update period')
    } finally {
      setIsLoading(false)
    }
  }, [editingPeriod, formData, loadData, resetForm])

  // Delete period
  const handleDelete = useCallback(async () => {
    if (!selectedPeriod) return

    setIsLoading(true)
    try {
      const result = await deleteBillingPeriod(selectedPeriod.id)

      if (result.error) {
        toast.error(`Failed to delete period: ${result.error}`)
      } else {
        toast.success('Billing period deleted successfully')
        setIsDeleteDialogOpen(false)
        setSelectedPeriod(null)
        await loadData()
      }
    } catch (error) {
      console.error('Error deleting period:', error)
      toast.error('Failed to delete period')
    } finally {
      setIsLoading(false)
    }
  }, [selectedPeriod, loadData])

  // Duplicate from snapshot
  const handleDuplicateFromSnapshot = useCallback((snapshot: MonthlySnapshot) => {
    const snapshotDate = new Date(snapshot.snapshot_date)
    const year = snapshotDate.getFullYear()
    const month = snapshotDate.getMonth()
    
    // Create period for the next month
    const startDate = new Date(year, month + 1, 1)
    const endDate = new Date(year, month + 2, 0) // Last day of next month

    setFormData({
      period_name: `${snapshot.month_year} Budget`,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      snapshot_id: snapshot.id,
      notes: `Duplicated from ${snapshot.month_year} snapshot`,
    })
    setIsCreateDialogOpen(true)
  }, [])

  // Format date for display
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }, [])

  // Calculate period duration in days
  const getPeriodDuration = useCallback((startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 // +1 to include both start and end
    return diffDays
  }, [])

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Header with Create Button */}
      <Card className="glass-large">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Billing Period Manager</CardTitle>
            <Button
              onClick={handleCreateClick}
              className="glass-small"
              disabled={isLoading}
            >
              Create Period
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm glass-text-secondary">
            Create and manage future billing periods for budgeting and planning
          </p>
        </CardContent>
      </Card>

      {/* Periods List */}
      <Card className="glass-large flex-1 min-h-0 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Future Billing Periods</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-auto">
          {isLoading && periods.length === 0 ? (
            <div className="text-center py-8 glass-text-secondary">
              Loading periods...
            </div>
          ) : sortedPeriods.length === 0 ? (
            <div className="text-center py-8 glass-text-secondary">
              <p className="mb-2">No future billing periods yet</p>
              <p className="text-sm">Create your first period to start budgeting</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedPeriods.map((period) => (
                <Card key={period.id} className="glass-small">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold glass-text-primary text-sm">
                            {period.period_name}
                          </h3>
                          {period.is_active && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-xs glass-text-secondary space-y-0.5">
                          <p>
                            {formatDate(period.start_date)} - {formatDate(period.end_date)}
                          </p>
                          <p>
                            Duration: {getPeriodDuration(period.start_date, period.end_date)} days
                          </p>
                          {period.snapshot_id && (
                            <p className="text-xs">
                              Linked to snapshot: {
                                snapshots.find((s) => s.id === period.snapshot_id)?.month_year || 'Unknown'
                              }
                            </p>
                          )}
                          {period.notes && (
                            <p className="mt-1 italic">{period.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(period)}
                          className="glass-small h-8 px-2 text-xs"
                          disabled={isLoading}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(period)}
                          className="glass-small h-8 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20"
                          disabled={isLoading}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Period Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContentGlass className="max-w-md">
          <DialogHeaderGlass>
            <DialogTitle>Create Billing Period</DialogTitle>
            <DialogDescription>
              Create a new billing period for future budgeting
            </DialogDescription>
          </DialogHeaderGlass>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="period_name">Period Name</Label>
              <Input
                id="period_name"
                value={formData.period_name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, period_name: e.target.value }))
                }
                placeholder="e.g., January 2025 Budget"
                className="glass-small"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, start_date: e.target.value }))
                  }
                  className="glass-small"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, end_date: e.target.value }))
                  }
                  className="glass-small"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="snapshot_id">Link to Snapshot (Optional)</Label>
              <Select
                value={formData.snapshot_id || '__none__'}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, snapshot_id: value === '__none__' ? '' : value }))
                }
              >
                <SelectTrigger className="glass-small">
                  <SelectValue placeholder="Select a snapshot to duplicate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {snapshots.map((snapshot) => (
                    <SelectItem key={snapshot.id} value={snapshot.id}>
                      {snapshot.month_year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Add any notes about this period..."
                className="glass-small min-h-[80px]"
                rows={3}
              />
            </div>
          </div>
          <DialogFooterGlass>
            <Button
              variant="ghost"
              onClick={() => {
                setIsCreateDialogOpen(false)
                resetForm()
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isLoading} className="glass-small">
              {isLoading ? 'Creating...' : 'Create Period'}
            </Button>
          </DialogFooterGlass>
        </DialogContentGlass>
      </Dialog>

      {/* Edit Period Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContentGlass className="max-w-md">
          <DialogHeaderGlass>
            <DialogTitle>Edit Billing Period</DialogTitle>
            <DialogDescription>
              Update the billing period details
            </DialogDescription>
          </DialogHeaderGlass>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_period_name">Period Name</Label>
              <Input
                id="edit_period_name"
                value={formData.period_name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, period_name: e.target.value }))
                }
                placeholder="e.g., January 2025 Budget"
                className="glass-small"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_start_date">Start Date</Label>
                <Input
                  id="edit_start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, start_date: e.target.value }))
                  }
                  className="glass-small"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_end_date">End Date</Label>
                <Input
                  id="edit_end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, end_date: e.target.value }))
                  }
                  className="glass-small"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_snapshot_id">Link to Snapshot (Optional)</Label>
              <Select
                value={formData.snapshot_id || '__none__'}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, snapshot_id: value === '__none__' ? '' : value }))
                }
              >
                <SelectTrigger className="glass-small">
                  <SelectValue placeholder="Select a snapshot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {snapshots.map((snapshot) => (
                    <SelectItem key={snapshot.id} value={snapshot.id}>
                      {snapshot.month_year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_notes">Notes (Optional)</Label>
              <Textarea
                id="edit_notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Add any notes about this period..."
                className="glass-small min-h-[80px]"
                rows={3}
              />
            </div>
          </div>
          <DialogFooterGlass>
            <Button
              variant="ghost"
              onClick={() => {
                setIsEditDialogOpen(false)
                setEditingPeriod(null)
                resetForm()
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isLoading} className="glass-small">
              {isLoading ? 'Updating...' : 'Update Period'}
            </Button>
          </DialogFooterGlass>
        </DialogContentGlass>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContentGlass className="max-w-md">
          <DialogHeaderGlass>
            <DialogTitle>Delete Billing Period</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this billing period? This action cannot be undone.
            </DialogDescription>
          </DialogHeaderGlass>
          {selectedPeriod && (
            <div className="py-4">
              <div className="glass-small p-3 rounded">
                <p className="font-semibold glass-text-primary">{selectedPeriod.period_name}</p>
                <p className="text-sm glass-text-secondary mt-1">
                  {formatDate(selectedPeriod.start_date)} - {formatDate(selectedPeriod.end_date)}
                </p>
              </div>
            </div>
          )}
          <DialogFooterGlass>
            <Button
              variant="ghost"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setSelectedPeriod(null)
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isLoading}
              className="glass-small bg-red-500/20 text-red-400 hover:bg-red-500/30"
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooterGlass>
        </DialogContentGlass>
      </Dialog>

      {/* Duplicate from Snapshot Section */}
      {snapshots.length > 0 && (
        <Card className="glass-large">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Duplicate from Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm glass-text-secondary mb-3">
              Create a new period based on an existing monthly snapshot
            </p>
            <div className="space-y-2 max-h-48 overflow-auto">
              {snapshots.map((snapshot) => (
                <Button
                  key={snapshot.id}
                  variant="ghost"
                  onClick={() => handleDuplicateFromSnapshot(snapshot)}
                  className="w-full justify-start glass-small text-left h-auto py-2"
                  disabled={isLoading}
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm glass-text-primary">
                      {snapshot.month_year}
                    </p>
                    <p className="text-xs glass-text-secondary">
                      {formatDate(snapshot.snapshot_date)}
                    </p>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

