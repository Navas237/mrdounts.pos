import { Department } from '@/types/database';
import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { authService, DEFAULT_BRANCH } from './auth.service';

export interface MenuItemSize {
  id: string;
  name: string;
  price: number;
  is_default: boolean;
}

export interface MenuOption {
  id: string;
  name: string;
  extra_price: number;
  is_available: boolean;
}

export interface MenuOptionGroup {
  id: string;
  name: string;
  min_selections: number;
  max_selections: number;
  options: MenuOption[];
}

export interface MenuItem {
  id: string;
  department_id: string;
  name: string;
  description?: string;
  base_price: number;
  image_url?: string;
  is_active: boolean;
  sizes: MenuItemSize[];
  option_groups: MenuOptionGroup[];
}

export type DonutBoxType = 'regular' | 'mini' | 'stuffed';

// واجهة حجم البوكس الموحد (يدخل المستخدم عدد القطع وأسعار الأنواع الثلاثة معاً)
export interface UnifiedDonutBoxSize {
  id?: string;
  pieces: number;
  regular_price: number;
  mini_price: number;
  stuffed_price: number;
  is_active?: boolean;
}

export interface DonutStuffingOption extends MenuOption {}

export interface DonutBoxConfig {
  type: DonutBoxType;
  typeName: string;
  availableSizes: number[];
  boxPrices: Record<number, number>;
  stuffingSauces: DonutStuffingOption[];
  toppingSauces: MenuOption[];
}

function getActiveBranchId(): string {
  return authService.getCurrentSession()?.branch?.id || DEFAULT_BRANCH.id;
}

// البداية نظيفة تماماً بدون أي بيانات مسبقة (100% ديناميكية)
export const INITIAL_DEPARTMENTS: Department[] = [];
export const INITIAL_UNIFIED_BOX_SIZES: UnifiedDonutBoxSize[] = [];
export const INITIAL_STUFFING_SAUCES: MenuOption[] = [];
export const INITIAL_TOPPING_SAUCES: MenuOption[] = [];
export const INITIAL_MENU_ITEMS: MenuItem[] = [];

// مفاتيح التخزين المحلي v9
const STORAGE_KEYS = {
  departments: 'mr_donuts_v9_departments',
  donutUnifiedSizes: 'mr_donuts_v9_donut_sizes',
  donutStuffing: 'mr_donuts_v9_donut_stuffing',
  donutTopping: 'mr_donuts_v9_donut_topping',
  menuItems: 'mr_donuts_v9_menu_items',
};

// مسح المفاتيح القديمة عند التحديث لضمان إزالة أي بيانات قديمة
if (typeof window !== 'undefined') {
  try {
    for (let i = 1; i <= 8; i++) {
      localStorage.removeItem(`mr_donuts_v${i}_departments`);
      localStorage.removeItem(`mr_donuts_v${i}_donut_config`);
      localStorage.removeItem(`mr_donuts_v${i}_donut_sizes`);
      localStorage.removeItem(`mr_donuts_v${i}_menu_items`);
    }
  } catch {
    // ignore
  }
}

function notifyMenuUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mrdonuts:menu-updated'));
  }
}

// قراءة وحفظ الأقسام
function loadDepartments(): Department[] {
  if (typeof window === 'undefined') return INITIAL_DEPARTMENTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.departments);
    if (!raw) return INITIAL_DEPARTMENTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_DEPARTMENTS;
  } catch {
    return INITIAL_DEPARTMENTS;
  }
}

function saveDepartments(depts: Department[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.departments, JSON.stringify(depts));
  notifyMenuUpdate();
}

// قراءة وحفظ أحجام البوكسات الموحدة
function loadUnifiedBoxSizes(): UnifiedDonutBoxSize[] {
  if (typeof window === 'undefined') return INITIAL_UNIFIED_BOX_SIZES;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.donutUnifiedSizes);
    if (!raw) return INITIAL_UNIFIED_BOX_SIZES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_UNIFIED_BOX_SIZES;
  } catch {
    return INITIAL_UNIFIED_BOX_SIZES;
  }
}

function saveUnifiedBoxSizes(sizes: UnifiedDonutBoxSize[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.donutUnifiedSizes, JSON.stringify(sizes));
  notifyMenuUpdate();
}

// قراءة وحفظ صوصات الحشو والتوبنج (بدون أي ربط بينهما)
function loadDonutStuffing(): MenuOption[] {
  if (typeof window === 'undefined') return INITIAL_STUFFING_SAUCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.donutStuffing);
    if (!raw) return INITIAL_STUFFING_SAUCES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_STUFFING_SAUCES;
  } catch {
    return INITIAL_STUFFING_SAUCES;
  }
}

function saveDonutStuffing(sauces: MenuOption[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.donutStuffing, JSON.stringify(sauces));
  notifyMenuUpdate();
}

function loadDonutTopping(): MenuOption[] {
  if (typeof window === 'undefined') return INITIAL_TOPPING_SAUCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.donutTopping);
    if (!raw) return INITIAL_TOPPING_SAUCES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_TOPPING_SAUCES;
  } catch {
    return INITIAL_TOPPING_SAUCES;
  }
}

function saveDonutTopping(sauces: MenuOption[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.donutTopping, JSON.stringify(sauces));
  notifyMenuUpdate();
}

// قراءة وحفظ الأصناف العامة
function loadMenuItems(): MenuItem[] {
  if (typeof window === 'undefined') return INITIAL_MENU_ITEMS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.menuItems);
    if (!raw) return INITIAL_MENU_ITEMS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_MENU_ITEMS;
  } catch {
    return INITIAL_MENU_ITEMS;
  }
}

function saveMenuItems(items: MenuItem[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.menuItems, JSON.stringify(items));
  notifyMenuUpdate();
}

// واجهة الخدمة الشاملة
export const menuService = {
  // 1. الأقسام (Departments)
  getDepartmentsSync(): Department[] {
    return loadDepartments();
  },

  async getDepartments(_branchId?: string): Promise<Department[]> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        const branchId = _branchId || getActiveBranchId();
        const { data, error } = await supabase
          .from('departments')
          .select('*')
          .eq('branch_id', branchId)
          .order('sort_order', { ascending: true });

        if (!error && data) {
          saveDepartments(data);
          return data;
        }
      } catch (err) {
        console.warn('Failed to fetch departments from Supabase, using local:', err);
      }
    }
    return loadDepartments();
  },

  async saveDepartment(
    dept: Partial<Department> & { name: string; behavior: Department['behavior'] }
  ): Promise<Department> {
    const list = loadDepartments();
    let updated: Department;
    if (dept.id) {
      const idx = list.findIndex((d) => d.id === dept.id);
      if (idx !== -1) {
        updated = { ...list[idx], ...dept };
        list[idx] = updated;
      } else {
        updated = {
          id: dept.id,
          branch_id: getActiveBranchId(),
          name: dept.name,
          behavior: dept.behavior,
          prints_labels: Boolean(dept.prints_labels),
          sort_order: dept.sort_order || list.length + 1,
          is_active: dept.is_active !== false,
        };
        list.push(updated);
      }
    } else {
      updated = {
        id: `dept-${Date.now()}`,
        branch_id: getActiveBranchId(),
        name: dept.name,
        behavior: dept.behavior,
        prints_labels: Boolean(dept.prints_labels),
        sort_order: list.length + 1,
        is_active: true,
      };
      list.push(updated);
    }
    saveDepartments(list);

    if (isLiveSupabaseConfigured && supabase) {
      try {
        const branchId = getActiveBranchId();
        const payload: Record<string, unknown> = {
          branch_id: branchId,
          name: updated.name,
          behavior: updated.behavior,
          prints_labels: updated.prints_labels,
          sort_order: updated.sort_order,
          is_active: updated.is_active,
        };
        if (updated.id && !updated.id.startsWith('dept-')) {
          payload.id = updated.id;
        }
        const { data, error } = await supabase
          .from('departments')
          .upsert(payload)
          .select()
          .single();

        if (data && !error) {
          updated.id = data.id;
          saveDepartments(list);
        }
      } catch (err) {
        console.warn('Failed to sync department with Supabase:', err);
      }
    }

    return updated;
  },

  async deleteDepartment(deptId: string): Promise<void> {
    const list = loadDepartments().filter((d) => d.id !== deptId);
    saveDepartments(list);

    if (isLiveSupabaseConfigured && supabase && !deptId.startsWith('dept-')) {
      try {
        await supabase.from('departments').delete().eq('id', deptId);
      } catch (err) {
        console.warn('Failed to delete department from Supabase:', err);
      }
    }
  },

  // 2. أحجام البوكسات الموحدة (إدخال حجم واحد مع أسعار العادي والميني والحشو)
  getUnifiedBoxSizesSync(): UnifiedDonutBoxSize[] {
    return loadUnifiedBoxSizes();
  },

  async getUnifiedBoxSizes(): Promise<UnifiedDonutBoxSize[]> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        const branchId = getActiveBranchId();
        const { data, error } = await supabase
          .from('donut_box_sizes')
          .select('*')
          .eq('branch_id', branchId)
          .eq('is_active', true)
          .order('pieces', { ascending: true });

        if (!error && data) {
          const list: UnifiedDonutBoxSize[] = data.map((d: any) => ({
            id: d.id,
            pieces: d.pieces,
            regular_price: Number(d.regular_price || 0),
            mini_price: Number(d.mini_price || 0),
            stuffed_price: Number(d.stuffed_price || 0),
            is_active: d.is_active,
          }));
          saveUnifiedBoxSizes(list);
          return list;
        }
      } catch (err) {
        console.warn('Failed to load unified box sizes from Supabase:', err);
      }
    }
    return loadUnifiedBoxSizes();
  },

  async saveUnifiedBoxSize(box: {
    pieces: number;
    regular_price: number;
    mini_price: number;
    stuffed_price: number;
    id?: string;
  }): Promise<void> {
    const list = loadUnifiedBoxSizes();
    const idx = list.findIndex((b) => b.pieces === box.pieces);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...box };
    } else {
      list.push({ ...box, is_active: true });
      list.sort((a, b) => a.pieces - b.pieces);
    }
    saveUnifiedBoxSizes(list);

    if (isLiveSupabaseConfigured && supabase) {
      try {
        const branchId = getActiveBranchId();
        await supabase.from('donut_box_sizes').upsert(
          {
            branch_id: branchId,
            pieces: box.pieces,
            regular_price: box.regular_price,
            mini_price: box.mini_price,
            stuffed_price: box.stuffed_price,
            sort_order: box.pieces,
            is_active: true,
          },
          { onConflict: 'branch_id,pieces' }
        );
      } catch (err) {
        console.warn('Failed to save unified box size to Supabase:', err);
      }
    }
  },

  async deleteUnifiedBoxSize(pieces: number): Promise<void> {
    const list = loadUnifiedBoxSizes().filter((b) => b.pieces !== pieces);
    saveUnifiedBoxSizes(list);

    if (isLiveSupabaseConfigured && supabase) {
      try {
        const branchId = getActiveBranchId();
        await supabase
          .from('donut_box_sizes')
          .delete()
          .eq('branch_id', branchId)
          .eq('pieces', pieces);
      } catch (err) {
        console.warn('Failed to delete unified box size from Supabase:', err);
      }
    }
  },

  // 3. بنية الدونتس المتوافقة مع الكاشير والمطبخ
  getDonutConfigSync(boxType: DonutBoxType = 'regular'): DonutBoxConfig {
    const boxSizes = loadUnifiedBoxSizes();
    const stuffing = loadDonutStuffing();
    const topping = loadDonutTopping();

    const priceKey =
      boxType === 'regular'
        ? 'regular_price'
        : boxType === 'mini'
        ? 'mini_price'
        : 'stuffed_price';

    const typeName =
      boxType === 'regular' ? 'دونتس عادي' : boxType === 'mini' ? 'ميني دونتس' : 'دونتس حشو';

    const availableSizes = boxSizes
      .filter((b) => b.is_active !== false && (b[priceKey] > 0 || boxSizes.length <= 1))
      .map((b) => b.pieces)
      .sort((a, b) => a - b);

    const boxPrices: Record<number, number> = {};
    for (const b of boxSizes) {
      boxPrices[b.pieces] = b[priceKey] || 0;
    }

    return {
      type: boxType,
      typeName,
      availableSizes,
      boxPrices,
      stuffingSauces: stuffing,
      toppingSauces: topping,
    };
  },

  async getDonutConfig(boxType: DonutBoxType = 'regular'): Promise<DonutBoxConfig> {
    await this.getUnifiedBoxSizes();
    return this.getDonutConfigSync(boxType);
  },

  async getAllDonutConfigs(): Promise<Record<DonutBoxType, DonutBoxConfig>> {
    await this.getUnifiedBoxSizes();
    return {
      regular: this.getDonutConfigSync('regular'),
      mini: this.getDonutConfigSync('mini'),
      stuffed: this.getDonutConfigSync('stuffed'),
    };
  },

  // 4. صوصات الحشو والتوبنج (تخزين محلي مع مزامنة Supabase options/option_groups)
  getStuffingSaucesSync(): MenuOption[] {
    return loadDonutStuffing();
  },

  async getStuffingSauces(): Promise<MenuOption[]> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        const branchId = getActiveBranchId();
        const { data: group } = await supabase
          .from('option_groups')
          .select('id')
          .eq('branch_id', branchId)
          .eq('name', 'صوصات الحشو')
          .maybeSingle();

        if (group?.id) {
          const { data, error } = await supabase
            .from('options')
            .select('*')
            .eq('branch_id', branchId)
            .eq('group_id', group.id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

          if (!error && data && data.length > 0) {
            const list: MenuOption[] = data.map((d: any) => ({
              id: d.id,
              name: d.name,
              extra_price: Number(d.extra_price || 0),
              is_available: d.is_active,
            }));
            saveDonutStuffing(list);
            return list;
          }
        }
      } catch (err) {
        console.warn('Failed to load stuffing sauces from Supabase:', err);
      }
    }
    return loadDonutStuffing();
  },

  async saveStuffing(stuffing: {
    id?: string;
    name: string;
    extra_price: number;
    is_available?: boolean;
  }): Promise<void> {
    const list = loadDonutStuffing();
    let savedItem: MenuOption;

    if (stuffing.id) {
      const idx = list.findIndex((s) => s.id === stuffing.id);
      if (idx !== -1) {
        savedItem = {
          ...list[idx],
          name: stuffing.name,
          extra_price: stuffing.extra_price,
          is_available: stuffing.is_available !== false,
        };
        list[idx] = savedItem;
      } else {
        savedItem = {
          id: stuffing.id,
          name: stuffing.name,
          extra_price: stuffing.extra_price,
          is_available: true,
        };
        list.push(savedItem);
      }
    } else {
      savedItem = {
        id: `st-${Date.now()}`,
        name: stuffing.name,
        extra_price: stuffing.extra_price,
        is_available: true,
      };
      list.push(savedItem);
    }
    saveDonutStuffing(list);

    if (isLiveSupabaseConfigured && supabase) {
      try {
        const branchId = getActiveBranchId();
        // ضمان وجود مجموعة 'صوصات الحشو'
        let { data: grp } = await supabase
          .from('option_groups')
          .select('id')
          .eq('branch_id', branchId)
          .eq('name', 'صوصات الحشو')
          .maybeSingle();

        if (!grp?.id) {
          const { data: newGrp } = await supabase
            .from('option_groups')
            .insert({ branch_id: branchId, name: 'صوصات الحشو', sort_order: 1, is_active: true })
            .select('id')
            .single();
          grp = newGrp;
        }

        if (grp?.id) {
          const payload: Record<string, unknown> = {
            branch_id: branchId,
            group_id: grp.id,
            name: stuffing.name,
            extra_price: Number(stuffing.extra_price) || 0,
            is_active: stuffing.is_available !== false,
          };
          if (savedItem.id && !savedItem.id.startsWith('st-')) {
            payload.id = savedItem.id;
          }
          const { data: optData } = await supabase.from('options').upsert(payload).select().single();
          if (optData) {
            savedItem.id = optData.id;
            saveDonutStuffing(list);
          }
        }
      } catch (err) {
        console.warn('Failed to sync stuffing with Supabase:', err);
      }
    }
  },

  async deleteStuffing(stuffingId: string): Promise<void> {
    const list = loadDonutStuffing().filter((s) => s.id !== stuffingId);
    saveDonutStuffing(list);

    if (isLiveSupabaseConfigured && supabase && !stuffingId.startsWith('st-')) {
      try {
        await supabase.from('options').delete().eq('id', stuffingId);
      } catch (err) {
        console.warn('Failed to delete stuffing from Supabase:', err);
      }
    }
  },

  getToppingSaucesSync(): MenuOption[] {
    return loadDonutTopping();
  },

  async getToppingSauces(): Promise<MenuOption[]> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        const branchId = getActiveBranchId();
        const { data: group } = await supabase
          .from('option_groups')
          .select('id')
          .eq('branch_id', branchId)
          .eq('name', 'صوصات التوبنج')
          .maybeSingle();

        if (group?.id) {
          const { data, error } = await supabase
            .from('options')
            .select('*')
            .eq('branch_id', branchId)
            .eq('group_id', group.id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

          if (!error && data && data.length > 0) {
            const list: MenuOption[] = data.map((d: any) => ({
              id: d.id,
              name: d.name,
              extra_price: Number(d.extra_price || 0),
              is_available: d.is_active,
            }));
            saveDonutTopping(list);
            return list;
          }
        }
      } catch (err) {
        console.warn('Failed to load topping sauces from Supabase:', err);
      }
    }
    return loadDonutTopping();
  },

  async saveTopping(topping: {
    id?: string;
    name: string;
    extra_price: number;
    is_available?: boolean;
  }): Promise<void> {
    const list = loadDonutTopping();
    let savedItem: MenuOption;

    if (topping.id) {
      const idx = list.findIndex((t) => t.id === topping.id);
      if (idx !== -1) {
        savedItem = {
          ...list[idx],
          name: topping.name,
          extra_price: topping.extra_price,
          is_available: topping.is_available !== false,
        };
        list[idx] = savedItem;
      } else {
        savedItem = {
          id: topping.id,
          name: topping.name,
          extra_price: topping.extra_price,
          is_available: true,
        };
        list.push(savedItem);
      }
    } else {
      savedItem = {
        id: `tp-${Date.now()}`,
        name: topping.name,
        extra_price: topping.extra_price,
        is_available: true,
      };
      list.push(savedItem);
    }
    saveDonutTopping(list);

    if (isLiveSupabaseConfigured && supabase) {
      try {
        const branchId = getActiveBranchId();
        let { data: grp } = await supabase
          .from('option_groups')
          .select('id')
          .eq('branch_id', branchId)
          .eq('name', 'صوصات التوبنج')
          .maybeSingle();

        if (!grp?.id) {
          const { data: newGrp } = await supabase
            .from('option_groups')
            .insert({ branch_id: branchId, name: 'صوصات التوبنج', sort_order: 2, is_active: true })
            .select('id')
            .single();
          grp = newGrp;
        }

        if (grp?.id) {
          const payload: Record<string, unknown> = {
            branch_id: branchId,
            group_id: grp.id,
            name: topping.name,
            extra_price: Number(topping.extra_price) || 0,
            is_active: topping.is_available !== false,
          };
          if (savedItem.id && !savedItem.id.startsWith('tp-')) {
            payload.id = savedItem.id;
          }
          const { data: optData } = await supabase.from('options').upsert(payload).select().single();
          if (optData) {
            savedItem.id = optData.id;
            saveDonutTopping(list);
          }
        }
      } catch (err) {
        console.warn('Failed to sync topping with Supabase:', err);
      }
    }
  },

  async deleteTopping(toppingId: string): Promise<void> {
    const list = loadDonutTopping().filter((t) => t.id !== toppingId);
    saveDonutTopping(list);

    if (isLiveSupabaseConfigured && supabase && !toppingId.startsWith('tp-')) {
      try {
        await supabase.from('options').delete().eq('id', toppingId);
      } catch (err) {
        console.warn('Failed to delete topping from Supabase:', err);
      }
    }
  },

  // 5. الأصناف (Items) للأقسام الأخرى كالوافل والمشروبات
  getAllMenuItemsSync(): MenuItem[] {
    return loadMenuItems();
  },

  async getAllMenuItems(): Promise<MenuItem[]> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('menu_items')
          .select('*, sizes:item_sizes(*)')
          .order('sort_order', { ascending: true });

        if (!error && data) {
          const items: MenuItem[] = data.map((d: any) => ({
            id: d.id,
            department_id: d.department_id,
            name: d.name,
            description: d.description || '',
            base_price: Number(d.base_price || 0),
            is_active: d.is_active,
            sizes: (d.sizes || []).map((s: any) => ({
              id: s.id,
              name: s.name,
              price: Number(s.price),
              is_default: Boolean(s.is_default),
            })),
            option_groups: [],
          }));
          saveMenuItems(items);
          return items;
        }
      } catch (err) {
        console.warn('Failed to fetch all items from Supabase, using local:', err);
      }
    }
    return loadMenuItems();
  },

  getMenuItemsSync(departmentId: string): MenuItem[] {
    const items = loadMenuItems();
    return items.filter((m) => m.department_id === departmentId);
  },

  async getMenuItems(departmentId: string): Promise<MenuItem[]> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('menu_items')
          .select('*, sizes:item_sizes(*)')
          .eq('department_id', departmentId)
          .eq('is_active', true)
          .order('sort_order');

        if (!error && data) {
          const items: MenuItem[] = data.map((d: any) => ({
            id: d.id,
            department_id: d.department_id,
            name: d.name,
            description: d.description || '',
            base_price: Number(d.base_price || 0),
            is_active: d.is_active,
            sizes: (d.sizes || []).map((s: any) => ({
              id: s.id,
              name: s.name,
              price: Number(s.price),
              is_default: Boolean(s.is_default),
            })),
            option_groups: [],
          }));
          return items;
        }
      } catch (err) {
        console.warn('Failed to fetch items from Supabase, using local:', err);
      }
    }
    const items = loadMenuItems();
    return items.filter((m) => m.department_id === departmentId);
  },

  async saveMenuItem(item: MenuItem): Promise<MenuItem> {
    const items = loadMenuItems();
    let savedItem = { ...item };
    if (!savedItem.id) {
      savedItem.id = `it-${Date.now()}`;
    }

    const idx = items.findIndex((i) => i.id === savedItem.id);
    if (idx !== -1) {
      items[idx] = savedItem;
    } else {
      items.push(savedItem);
    }
    saveMenuItems(items);

    if (isLiveSupabaseConfigured && supabase) {
      try {
        const branchId = getActiveBranchId();
        const payload: Record<string, unknown> = {
          branch_id: branchId,
          department_id: savedItem.department_id,
          name: savedItem.name,
          description: savedItem.description || null,
          base_price: Number(savedItem.base_price) || 0,
          is_active: savedItem.is_active !== false,
        };
        const isUuid = (val?: string) =>
          typeof val === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

        if (isUuid(savedItem.id)) {
          payload.id = savedItem.id;
        }

        const { data: inserted, error: itemErr } = await supabase
          .from('menu_items')
          .upsert(payload)
          .select('id')
          .single();

        if (!itemErr && inserted) {
          savedItem.id = inserted.id;
          items[idx !== -1 ? idx : items.length - 1] = savedItem;
          saveMenuItems(items);

          // حفظ الأحجام في جدول item_sizes
          if (savedItem.sizes && savedItem.sizes.length > 0) {
            await supabase.from('item_sizes').delete().eq('item_id', savedItem.id);
            const sizesPayload = savedItem.sizes.map((s, sIdx) => ({
              branch_id: branchId,
              item_id: savedItem.id,
              name: s.name,
              price: Number(s.price) || 0,
              is_default: Boolean(s.is_default),
              sort_order: sIdx + 1,
              is_active: true,
            }));
            await supabase.from('item_sizes').insert(sizesPayload);
          }
        }
      } catch (err) {
        console.warn('Failed to save menu item to Supabase:', err);
      }
    }

    return savedItem;
  },

  async toggleMenuItemStatus(itemId: string, isActive: boolean): Promise<void> {
    const items = loadMenuItems();
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx !== -1) {
      items[idx].is_active = isActive;
      saveMenuItems(items);
    }

    if (isLiveSupabaseConfigured && supabase && !itemId.startsWith('it-')) {
      try {
        await supabase.from('menu_items').update({ is_active: isActive }).eq('id', itemId);
      } catch (err) {
        console.warn('Failed to toggle item status in Supabase:', err);
      }
    }
  },

  async deleteMenuItem(itemId: string): Promise<void> {
    const items = loadMenuItems().filter((i) => i.id !== itemId);
    saveMenuItems(items);

    if (isLiveSupabaseConfigured && supabase && !itemId.startsWith('it-')) {
      try {
        await supabase.from('menu_items').delete().eq('id', itemId);
      } catch (err) {
        console.warn('Failed to delete item from Supabase:', err);
      }
    }
  },

  // 6. خيارات وصوصات الأقسام المخصصة (مثل صوصات وإضافات الوافل)
  getDepartmentOptionsSync(departmentId: string): MenuOption[] {
    const key = `mrdonuts_v9_dept_options_${departmentId}`;
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveDepartmentOptionsSync(departmentId: string, options: MenuOption[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`mrdonuts_v9_dept_options_${departmentId}`, JSON.stringify(options));
    notifyMenuUpdate();
  },

  async getDepartmentOptions(departmentId: string): Promise<MenuOption[]> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        const branchId = getActiveBranchId();
        const { data: groups } = await supabase
          .from('option_groups')
          .select('id, name')
          .eq('branch_id', branchId);

        if (groups && groups.length > 0) {
          // جلب الخيارات التابعة للمجموعات
          const groupIds = groups.map((g) => g.id);
          const { data: optionsData } = await supabase
            .from('options')
            .select('*')
            .in('group_id', groupIds)
            .eq('is_active', true);

          if (optionsData && optionsData.length > 0) {
            const list: MenuOption[] = optionsData.map((d: any) => ({
              id: d.id,
              name: d.name,
              extra_price: Number(d.extra_price || 0),
              is_available: d.is_active,
            }));
            this.saveDepartmentOptionsSync(departmentId, list);
            return list;
          }
        }
      } catch (err) {
        console.warn('Failed to load department options from Supabase:', err);
      }
    }
    return this.getDepartmentOptionsSync(departmentId);
  },

  async saveDepartmentOption(
    departmentId: string,
    option: { id?: string; name: string; extra_price: number; is_available?: boolean }
  ): Promise<void> {
    const list = this.getDepartmentOptionsSync(departmentId);
    let saved: MenuOption;
    if (option.id) {
      const idx = list.findIndex((o) => o.id === option.id);
      if (idx !== -1) {
        saved = { ...list[idx], ...option, is_available: option.is_available !== false };
        list[idx] = saved;
      } else {
        saved = {
          id: option.id,
          name: option.name,
          extra_price: option.extra_price,
          is_available: option.is_available !== false,
        };
        list.push(saved);
      }
    } else {
      saved = {
        id: `opt-${Date.now()}`,
        name: option.name,
        extra_price: option.extra_price,
        is_available: true,
      };
      list.push(saved);
    }
    this.saveDepartmentOptionsSync(departmentId, list);
  },

  async deleteDepartmentOption(departmentId: string, optionId: string): Promise<void> {
    const list = this.getDepartmentOptionsSync(departmentId).filter((o) => o.id !== optionId);
    this.saveDepartmentOptionsSync(departmentId, list);
  },
};
