/**
 * Type definitions for PTAR Checklist App
 */

export type User = {
  id: string
  email: string
  name: string
  role: 'admin' | 'supervisor' | 'operator' | 'standard'
  plantId?: string | null
}

export type Plant = {
  id: string
  name: string
  location: string
  status: 'active' | 'inactive' | 'maintenance'
}

export type ChecklistItem = {
  id: string
  checklist_id: string
  equipment_id: string | null
  item_description: string
  category: string
  is_checked: boolean
  is_red_flag: boolean
  red_flag_comment: string | null
  observation: string | null
  photo_path: string | null
  item_code?: string
  equipment_description?: string
  checked_at: string | null
}

export type DailyChecklist = {
  id: string
  plant_id: string
  check_date: string
  operator_name: string
  completed_at: string | null
  notes: string | null
  supervisor_notified: boolean
}

export type ChecklistData = {
  checklist: DailyChecklist
  items: Record<string, ChecklistItem[]>
  progress: number
  total: number
  checked: number
  redFlags: number
}

export type ChecklistTemplate = {
  id: string
  plant_id: string
  template_name: string
  template_code: string
  description: string
  item_count: number
}

export type SupervisorReport = {
  id: string
  checklist_id: string
  plant_id: string
  plant_name: string
  operator_name: string
  report_date: string
  total_items: number
  checked_items: number
  red_flag_count: number
  notes: string | null
  sent_at: string
  read_at: string | null
  read_by: string | null
}

export type ChecklistHistory = {
  id: string
  plant_id: string
  plant_name: string
  check_date: string
  operator_name: string
  completed_at: string | null
  total_items: number
  checked_items: number
  red_flags: number
}

export type RedFlagReport = {
  checklist_id: string
  plant_name: string
  operator_name: string
  check_date: string
  items: Array<{
    item_description: string
    category: string
    comment: string
    photo_path: string | null
  }>
}
