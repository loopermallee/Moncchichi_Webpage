
import { ChecklistItem, Subtask, RecurrenceConfig } from '../types';

const STORAGE_KEY = 'moncchichi_checklist';

class ChecklistService {
  private listeners: (() => void)[] = [];

  private getItemsFromStorage(): ChecklistItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  private saveItems(items: ChecklistItem[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    this.notifyListeners();
  }

  public subscribe(callback: () => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  /**
   * Checks all recurring items. If an item is marked "completed" but its 
   * nextDueAt has passed, reset it to "active" (completed = false).
   */
  private refreshRecurringItems(items: ChecklistItem[]): boolean {
      let changed = false;
      const now = Date.now();

      items.forEach(item => {
          if (item.recurrence && item.completed && item.recurrence.nextDueAt) {
              if (now >= item.recurrence.nextDueAt) {
                  item.completed = false; // It reappears in Active list
                  // We keep nextDueAt as is until they complete it again, 
                  // or we could shift it? For now, standard behavior is "It's due now".
                  changed = true;
              }
          }
      });
      return changed;
  }

  public getItems(): ChecklistItem[] {
    const items = this.getItemsFromStorage();
    if (this.refreshRecurringItems(items)) {
        this.saveItems(items);
    }
    return items.sort((a, b) => a.dueDate - b.dueDate);
  }

  public getActiveItems(): ChecklistItem[] {
    return this.getItems().filter(i => !i.completed);
  }

  public getCompletedItems(): ChecklistItem[] {
    // Sort completed by most recently completed/created (descending)
    return this.getItems()
      .filter(i => i.completed)
      .sort((a, b) => {
          const timeA = a.recurrence?.lastCompletedAt || a.createdAt;
          const timeB = b.recurrence?.lastCompletedAt || b.createdAt;
          return timeB - timeA;
      });
  }

  public addItem(text: string, daysOffset: number = 0, recurrence?: RecurrenceConfig): ChecklistItem {
    const now = new Date();
    if (daysOffset > 0) {
        now.setDate(now.getDate() + daysOffset);
    }
    // Default to Today end of day
    const dueDate = new Date(now);
    dueDate.setHours(23, 59, 59, 999);

    const newItem: ChecklistItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      text: text.trim(),
      description: '',
      completed: false,
      dueDate: dueDate.getTime(),
      createdAt: Date.now(),
      subtasks: [],
      recurrence: recurrence
    };

    const items = this.getItemsFromStorage();
    items.push(newItem);
    this.saveItems(items);
    return newItem;
  }

  public updateItemDetails(id: string, updates: Partial<ChecklistItem>) {
    const items = this.getItemsFromStorage();
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) {
      items[idx] = { ...items[idx], ...updates };
      this.saveItems(items);
    }
  }

  public toggleItem(id: string) {
    const items = this.getItemsFromStorage();
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) {
      const item = items[idx];
      
      if (!item.completed && item.recurrence) {
          // Completing a recurring item
          const now = Date.now();
          item.recurrence.lastCompletedAt = now;
          item.completed = true;

          // Calculate Next Due
          const nextDue = new Date();
          nextDue.setDate(nextDue.getDate() + item.recurrence.intervalDays);
          // Set to start of that day (00:00) so it becomes due immediately when that day starts
          nextDue.setHours(0, 0, 0, 0);
          
          item.recurrence.nextDueAt = nextDue.getTime();
          
          // Note: It stays 'completed' (in history) until refreshRecurringItems() 
          // detects that now >= nextDueAt
      } else if (item.completed && item.recurrence) {
          // Un-completing a recurring item (accidental check)
          // Just reset it to active state, keep existing nextDueAt or clear it?
          // Simplest is to just mark incomplete.
          item.completed = false;
      } else {
          // Normal One-off
          item.completed = !item.completed;
      }
      
      this.saveItems(items);
    }
  }
  
  public restoreItem(id: string) {
      const items = this.getItemsFromStorage();
      const idx = items.findIndex(i => i.id === id);
      if (idx !== -1) {
          items[idx].completed = false;
          this.saveItems(items);
      }
  }

  public deleteItem(id: string) {
    const items = this.getItemsFromStorage().filter(i => i.id !== id);
    this.saveItems(items);
  }

  public clearCompleted() {
    // Only delete non-recurring completed items. 
    // Recurring items in 'completed' state are just waiting for their next cycle.
    const items = this.getItemsFromStorage().filter(i => !i.completed || !!i.recurrence);
    this.saveItems(items);
  }

  // --- Subtask Management ---

  public addSubtask(parentId: string, text: string) {
      const items = this.getItemsFromStorage();
      const parent = items.find(i => i.id === parentId);
      if (parent) {
          if (!parent.subtasks) parent.subtasks = [];
          parent.subtasks.push({
              id: Date.now().toString(36) + Math.random().toString(36).substr(2),
              text: text.trim(),
              completed: false
          });
          this.saveItems(items);
      }
  }

  public toggleSubtask(parentId: string, subtaskId: string) {
      const items = this.getItemsFromStorage();
      const parent = items.find(i => i.id === parentId);
      if (parent && parent.subtasks) {
          const sub = parent.subtasks.find(s => s.id === subtaskId);
          if (sub) {
              sub.completed = !sub.completed;
              this.saveItems(items);
          }
      }
  }

  public deleteSubtask(parentId: string, subtaskId: string) {
      const items = this.getItemsFromStorage();
      const parent = items.find(i => i.id === parentId);
      if (parent && parent.subtasks) {
          parent.subtasks = parent.subtasks.filter(s => s.id !== subtaskId);
          this.saveItems(items);
      }
  }

  public parseTimeQuery(text: string): number {
    const t = text.toLowerCase();
    if (t.includes('tomorrow')) return 1;
    if (t.includes('next week')) return 7;
    return 0; // Default today
  }
}

export const checklistService = new ChecklistService();
