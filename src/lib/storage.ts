import { getSupabaseClient } from './supabase';
import {
  Subject,
  Assignment,
  Exam,
  StudySession,
  AcademicPeriod,
  UserProfile,
} from '../types';

export type SyncState = 'synced' | 'saving' | 'local' | 'error';

// Initial Starter Data for a clean, rich first impression
export const DEFAULT_SUBJECTS: Subject[] = [
  {
    id: 'sub-matematicas',
    name: 'Matemáticas II',
    color: '#10b981', // emerald
    teacher: 'Prof. García',
    weekly_goal_minutes: 240,
    notes: 'Cálculo diferencial, integrales y álgebra matricial.',
  },
  {
    id: 'sub-fisica',
    name: 'Física',
    color: '#3b82f6', // blue
    teacher: 'Dra. Méndez',
    weekly_goal_minutes: 180,
    notes: 'Campo electromagnético y termodinámica.',
  },
  {
    id: 'sub-quimica',
    name: 'Química',
    color: '#8b5cf6', // purple
    teacher: 'Prof. Romero',
    weekly_goal_minutes: 150,
    notes: 'Química orgánica y equilibrios ácido-base.',
  },
  {
    id: 'sub-historia',
    name: 'Historia de España',
    color: '#f59e0b', // amber
    teacher: 'Prof. Navas',
    weekly_goal_minutes: 120,
    notes: 'Temario EVAU y comentarios de texto.',
  },
  {
    id: 'sub-ingles',
    name: 'Inglés Avanzado',
    color: '#06b6d4', // cyan
    teacher: 'Ms. Taylor',
    weekly_goal_minutes: 90,
    notes: 'Preparación C1 Advanced y ensayos argumentativos.',
  },
];

// Helper to calculate date relative to today
const getRelativeDateISO = (daysOffset: number, hours = 18, minutes = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

export const DEFAULT_ASSIGNMENTS: Assignment[] = [
  {
    id: 'asg-1',
    subject_id: 'sub-matematicas',
    title: 'Boletín de Integrales Definidas (ejercicios 12 al 25)',
    description: 'Calcular el área entre dos curvas y resolver problemas de optimización.',
    due_date: getRelativeDateISO(0, 20, 0), // Today!
    priority: 'alta',
    status: 'pendiente',
    estimated_minutes: 60,
    actual_minutes: 0,
    created_at: getRelativeDateISO(-2),
    notes: 'Revisar apuntes de la regla de Barrow.',
  },
  {
    id: 'asg-2',
    subject_id: 'sub-fisica',
    title: 'Informe de Laboratorio: Péndulo Simple',
    description: 'Redactar conclusiones y calcular incertidumbre en las mediciones.',
    due_date: getRelativeDateISO(-1, 23, 59), // Atrasado
    priority: 'alta',
    status: 'pendiente',
    estimated_minutes: 45,
    actual_minutes: 15,
    created_at: getRelativeDateISO(-4),
    notes: 'Falta añadir las gráficas del ajuste por mínimos cuadrados.',
  },
  {
    id: 'asg-3',
    subject_id: 'sub-historia',
    title: 'Comentario de Texto: Constitución de 1812',
    description: 'Análisis de soberanía nacional y separación de poderes.',
    due_date: getRelativeDateISO(2, 17, 30),
    priority: 'media',
    status: 'pendiente',
    estimated_minutes: 50,
    actual_minutes: 0,
    created_at: getRelativeDateISO(-1),
  },
  {
    id: 'asg-4',
    subject_id: 'sub-quimica',
    title: 'Problemas de pH y valoraciones redox',
    description: 'Ejercicios de autoevaluación del bloque 4.',
    due_date: getRelativeDateISO(-3, 14, 0),
    priority: 'media',
    status: 'completado',
    estimated_minutes: 40,
    actual_minutes: 35,
    completed_at: getRelativeDateISO(-2, 18, 20),
    created_at: getRelativeDateISO(-5),
  },
  {
    id: 'asg-5',
    subject_id: 'sub-ingles',
    title: 'Essay: The impact of AI on higher education',
    description: '280 words, formal style, using inversion and advanced linkers.',
    due_date: getRelativeDateISO(4, 21, 0),
    priority: 'baja',
    status: 'pendiente',
    estimated_minutes: 45,
    actual_minutes: 0,
    created_at: getRelativeDateISO(-1),
  },
];

export const DEFAULT_EXAMS: Exam[] = [
  {
    id: 'ex-1',
    subject_id: 'sub-matematicas',
    name: 'Examen Bloque II: Análisis y Cálculo Integral',
    exam_date: getRelativeDateISO(3, 9, 30),
    syllabus: 'Límites, continuidad, derivadas, optimización e integrales inmediatas.',
    priority: 'alta',
    status: 'pendiente',
    max_grade: 10,
    weight_percentage: 35,
    notes: 'Traer calculadora no programable y regla.',
    created_at: getRelativeDateISO(-10),
  },
  {
    id: 'ex-2',
    subject_id: 'sub-fisica',
    name: 'Parcial de Electromagnetismo',
    exam_date: getRelativeDateISO(8, 11, 0),
    syllabus: 'Ley de Coulomb, campo eléctrico, potencial y circuitos RLC.',
    priority: 'alta',
    status: 'pendiente',
    max_grade: 10,
    weight_percentage: 40,
    created_at: getRelativeDateISO(-7),
  },
  {
    id: 'ex-3',
    subject_id: 'sub-historia',
    name: 'Examen Parcial: Siglo XIX en España',
    exam_date: getRelativeDateISO(-5, 10, 0),
    syllabus: 'Guerra de la Independencia, reinado de Fernando VII y regencias.',
    priority: 'media',
    status: 'corregido',
    grade: 9.25,
    max_grade: 10,
    weight_percentage: 25,
    notes: 'Excelente redacción en el comentario de texto.',
    created_at: getRelativeDateISO(-20),
  },
  {
    id: 'ex-4',
    subject_id: 'sub-quimica',
    name: 'Control Rápido de Estequiometría',
    exam_date: getRelativeDateISO(-12, 12, 0),
    syllabus: 'Reactivo limitante, pureza y rendimiento.',
    priority: 'media',
    status: 'corregido',
    grade: 8.50,
    max_grade: 10,
    weight_percentage: 20,
    created_at: getRelativeDateISO(-25),
  },
];

export const DEFAULT_STUDY_SESSIONS: StudySession[] = [
  {
    id: 'ses-1',
    subject_id: 'sub-matematicas',
    description: 'Práctica de derivadas complejas y regla de la cadena',
    start_time: getRelativeDateISO(0, 8, 30),
    end_time: getRelativeDateISO(0, 9, 15),
    duration_minutes: 45,
    completed: true,
    created_at: getRelativeDateISO(0, 9, 15),
  },
  {
    id: 'ses-2',
    subject_id: 'sub-fisica',
    description: 'Repaso fórmulas de potencial eléctrico',
    start_time: getRelativeDateISO(0, 11, 0),
    end_time: getRelativeDateISO(0, 11, 30),
    duration_minutes: 30,
    completed: true,
    created_at: getRelativeDateISO(0, 11, 30),
  },
];

export const DEFAULT_PERIODS: AcademicPeriod[] = [
  {
    id: 'per-1',
    name: '1º Trimestre',
    start_date: new Date(new Date().getFullYear(), 8, 15).toISOString().split('T')[0], // 15 Sept
    end_date: new Date(new Date().getFullYear(), 11, 20).toISOString().split('T')[0], // 20 Dic
  },
  {
    id: 'per-2',
    name: '2º Trimestre',
    start_date: new Date(new Date().getFullYear(), 0, 8).toISOString().split('T')[0], // 8 Ene
    end_date: new Date(new Date().getFullYear(), 2, 28).toISOString().split('T')[0], // 28 Mar
  },
  {
    id: 'per-3',
    name: '3º Trimestre',
    start_date: new Date(new Date().getFullYear(), 3, 10).toISOString().split('T')[0], // 10 Abr
    end_date: new Date(new Date().getFullYear(), 5, 20).toISOString().split('T')[0], // 20 Jun
  },
];

export const DEFAULT_PROFILE: UserProfile = {
  id: 'local-user',
  full_name: 'Estudiante StudyFlow',
  daily_study_goal_minutes: 120,
  reminder_time: '14:15',
  reminder_days: [1, 2, 3, 4, 5, 6, 7],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid',
  notify_daily_reminder: true,
  notify_upcoming_exams: true,
  notify_due_assignments: true,
  notify_overdue_tasks: true,
  notify_study_sessions: true,
};

// ----------------------------------------------------------------------
// DATA STORAGE CLASS WITH REAL SUPABASE SYNC AND ROBUST LOCAL FALLBACK
// ----------------------------------------------------------------------

class DataService {
  private syncListeners: ((state: SyncState) => void)[] = [];
  private currentSyncState: SyncState = 'local';

  public onSyncChange(listener: (state: SyncState) => void) {
    this.syncListeners.push(listener);
    listener(this.currentSyncState);
    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== listener);
    };
  }

  private setSyncState(state: SyncState) {
    this.currentSyncState = state;
    this.syncListeners.forEach((l) => l(state));
  }

  // Generic local storage helpers
  private getLocal<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem(`studyflow_${key}`);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private setLocal<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`studyflow_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn('Error saving to localStorage:', e);
    }
  }

  // ------------------------------------
  // SUBJECTS
  // ------------------------------------
  async getSubjects(): Promise<Subject[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (user?.user) {
          const { data, error } = await supabase
            .from('subjects')
            .select('*')
            .order('name', { ascending: true });

          if (error) throw error;
          if (data && data.length > 0) {
            this.setLocal('subjects', data);
            this.setSyncState('synced');
            return data;
          }
        }
      } catch (err) {
        console.warn('[Supabase] Failed to fetch subjects from cloud, using cache:', err);
        this.setSyncState('error');
      }
    }
    const local = this.getLocal<Subject[]>('subjects', DEFAULT_SUBJECTS);
    this.setSyncState(supabase ? 'synced' : 'local');
    return local;
  }

  async saveSubject(subject: Subject): Promise<Subject> {
    this.setSyncState('saving');
    const local = this.getLocal<Subject[]>('subjects', DEFAULT_SUBJECTS);
    const index = local.findIndex((s) => s.id === subject.id);
    const updated = [...local];
    if (index >= 0) {
      updated[index] = { ...subject, updated_at: new Date().toISOString() };
    } else {
      updated.push({
        ...subject,
        id: subject.id || 'sub-' + Date.now(),
        created_at: new Date().toISOString(),
      });
    }
    this.setLocal('subjects', updated);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (user?.user) {
          const payload = {
            ...subject,
            user_id: user.user.id,
            updated_at: new Date().toISOString(),
          };
          const { data, error } = await supabase.from('subjects').upsert(payload).select().single();
          if (error) throw error;
          this.setSyncState('synced');
          return data;
        }
      } catch (err) {
        console.error('[Supabase] Error saving subject to cloud:', err);
        this.setSyncState('error');
      }
    }

    this.setSyncState(supabase ? 'synced' : 'local');
    return index >= 0 ? updated[index] : updated[updated.length - 1];
  }

  async deleteSubject(id: string): Promise<void> {
    this.setSyncState('saving');
    const local = this.getLocal<Subject[]>('subjects', DEFAULT_SUBJECTS);
    this.setLocal('subjects', local.filter((s) => s.id !== id));

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('subjects').delete().eq('id', id);
        this.setSyncState('synced');
      } catch (err) {
        console.error('[Supabase] Error deleting subject:', err);
        this.setSyncState('error');
      }
    } else {
      this.setSyncState('local');
    }
  }

  // ------------------------------------
  // ASSIGNMENTS (DEBERES)
  // ------------------------------------
  async getAssignments(): Promise<Assignment[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (user?.user) {
          const { data, error } = await supabase
            .from('assignments')
            .select('*')
            .order('due_date', { ascending: true });

          if (error) throw error;
          if (data && data.length > 0) {
            this.setLocal('assignments', data);
            this.setSyncState('synced');
            return data;
          }
        }
      } catch (err) {
        console.warn('[Supabase] Error fetching assignments:', err);
        this.setSyncState('error');
      }
    }
    return this.getLocal<Assignment[]>('assignments', DEFAULT_ASSIGNMENTS);
  }

  async saveAssignment(assignment: Assignment): Promise<Assignment> {
    this.setSyncState('saving');
    const local = this.getLocal<Assignment[]>('assignments', DEFAULT_ASSIGNMENTS);
    const index = local.findIndex((a) => a.id === assignment.id);
    const updated = [...local];
    const itemToSave: Assignment = {
      ...assignment,
      id: assignment.id || 'asg-' + Date.now(),
      created_at: assignment.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (index >= 0) {
      updated[index] = itemToSave;
    } else {
      updated.push(itemToSave);
    }
    this.setLocal('assignments', updated);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (user?.user) {
          const { data, error } = await supabase
            .from('assignments')
            .upsert({ ...itemToSave, user_id: user.user.id })
            .select()
            .single();
          if (error) throw error;
          this.setSyncState('synced');
          return data;
        }
      } catch (err) {
        console.error('[Supabase] Error saving assignment to cloud:', err);
        this.setSyncState('error');
      }
    }
    this.setSyncState(supabase ? 'synced' : 'local');
    return itemToSave;
  }

  async toggleAssignmentStatus(id: string): Promise<Assignment | null> {
    const assignments = await this.getAssignments();
    const item = assignments.find((a) => a.id === id);
    if (!item) return null;

    const isNowCompleted = item.status !== 'completado';
    const updated: Assignment = {
      ...item,
      status: isNowCompleted ? 'completado' : 'pendiente',
      completed_at: isNowCompleted ? new Date().toISOString() : null,
    };

    return await this.saveAssignment(updated);
  }

  async deleteAssignment(id: string): Promise<void> {
    this.setSyncState('saving');
    const local = this.getLocal<Assignment[]>('assignments', DEFAULT_ASSIGNMENTS);
    this.setLocal('assignments', local.filter((a) => a.id !== id));

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('assignments').delete().eq('id', id);
        this.setSyncState('synced');
      } catch (err) {
        console.error('[Supabase] Error deleting assignment:', err);
        this.setSyncState('error');
      }
    } else {
      this.setSyncState('local');
    }
  }

  // ------------------------------------
  // EXAMS (EXÁMENES Y NOTAS)
  // ------------------------------------
  async getExams(): Promise<Exam[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (user?.user) {
          const { data, error } = await supabase
            .from('exams')
            .select('*')
            .order('exam_date', { ascending: true });

          if (error) throw error;
          if (data && data.length > 0) {
            this.setLocal('exams', data);
            this.setSyncState('synced');
            return data;
          }
        }
      } catch (err) {
        console.warn('[Supabase] Error fetching exams:', err);
        this.setSyncState('error');
      }
    }
    return this.getLocal<Exam[]>('exams', DEFAULT_EXAMS);
  }

  async saveExam(exam: Exam): Promise<Exam> {
    this.setSyncState('saving');
    const local = this.getLocal<Exam[]>('exams', DEFAULT_EXAMS);
    const index = local.findIndex((e) => e.id === exam.id);
    const updated = [...local];
    const itemToSave: Exam = {
      ...exam,
      id: exam.id || 'ex-' + Date.now(),
      created_at: exam.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (index >= 0) {
      updated[index] = itemToSave;
    } else {
      updated.push(itemToSave);
    }
    this.setLocal('exams', updated);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (user?.user) {
          const { data, error } = await supabase
            .from('exams')
            .upsert({ ...itemToSave, user_id: user.user.id })
            .select()
            .single();
          if (error) throw error;
          this.setSyncState('synced');
          return data;
        }
      } catch (err) {
        console.error('[Supabase] Error saving exam to cloud:', err);
        this.setSyncState('error');
      }
    }
    this.setSyncState(supabase ? 'synced' : 'local');
    return itemToSave;
  }

  async deleteExam(id: string): Promise<void> {
    this.setSyncState('saving');
    const local = this.getLocal<Exam[]>('exams', DEFAULT_EXAMS);
    this.setLocal('exams', local.filter((e) => e.id !== id));

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('exams').delete().eq('id', id);
        this.setSyncState('synced');
      } catch (err) {
        console.error('[Supabase] Error deleting exam:', err);
        this.setSyncState('error');
      }
    } else {
      this.setSyncState('local');
    }
  }

  // ------------------------------------
  // STUDY SESSIONS (TEMPORIZADOR)
  // ------------------------------------
  async getStudySessions(): Promise<StudySession[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (user?.user) {
          const { data, error } = await supabase
            .from('study_sessions')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;
          if (data) {
            this.setLocal('study_sessions', data);
            return data;
          }
        }
      } catch (err) {
        console.warn('[Supabase] Error fetching sessions:', err);
      }
    }
    return this.getLocal<StudySession[]>('study_sessions', DEFAULT_STUDY_SESSIONS);
  }

  async saveStudySession(session: StudySession): Promise<StudySession> {
    const local = this.getLocal<StudySession[]>('study_sessions', DEFAULT_STUDY_SESSIONS);
    const item: StudySession = {
      ...session,
      id: session.id || 'ses-' + Date.now(),
      created_at: session.created_at || new Date().toISOString(),
    };
    const updated = [item, ...local];
    this.setLocal('study_sessions', updated);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (user?.user) {
          const { data, error } = await supabase
            .from('study_sessions')
            .insert({ ...item, user_id: user.user.id })
            .select()
            .single();
          if (error) throw error;
          return data;
        }
      } catch (err) {
        console.error('[Supabase] Error saving study session:', err);
      }
    }
    return item;
  }

  // ------------------------------------
  // USER PROFILE & PREFERENCES
  // ------------------------------------
  async getProfile(): Promise<UserProfile> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (user?.user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.user.id)
            .single();

          if (!error && data) {
            this.setLocal('profile', data);
            return data;
          }
        }
      } catch (err) {
        console.warn('[Supabase] Error fetching profile:', err);
      }
    }
    return this.getLocal<UserProfile>('profile', DEFAULT_PROFILE);
  }

  async updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    const current = await this.getProfile();
    const updated: UserProfile = { ...current, ...profile, updated_at: new Date().toISOString() };
    this.setLocal('profile', updated);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (user?.user) {
          const { data, error } = await supabase
            .from('profiles')
            .upsert({ ...updated, id: user.user.id })
            .select()
            .single();
          if (error) throw error;
          return data;
        }
      } catch (err) {
        console.error('[Supabase] Error updating profile:', err);
      }
    }
    return updated;
  }

  // ------------------------------------
  // ACADEMIC PERIODS
  // ------------------------------------
  async getAcademicPeriods(): Promise<AcademicPeriod[]> {
    return this.getLocal<AcademicPeriod[]>('periods', DEFAULT_PERIODS);
  }

  async saveAcademicPeriods(periods: AcademicPeriod[]): Promise<void> {
    this.setLocal('periods', periods);
  }

  // ------------------------------------
  // BACKUP EXPORT & IMPORT
  // ------------------------------------
  async exportAllData(): Promise<string> {
    const subjects = await this.getSubjects();
    const assignments = await this.getAssignments();
    const exams = await this.getExams();
    const sessions = await this.getStudySessions();
    const profile = await this.getProfile();
    const periods = await this.getAcademicPeriods();

    const backup = {
      version: '1.0',
      export_date: new Date().toISOString(),
      profile,
      subjects,
      assignments,
      exams,
      sessions,
      periods,
    };
    return JSON.stringify(backup, null, 2);
  }

  async importData(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString);
      if (!data.subjects || !data.assignments || !data.exams) {
        throw new Error('El archivo no contiene un formato de respaldo válido de StudyFlow.');
      }
      this.setLocal('subjects', data.subjects);
      this.setLocal('assignments', data.assignments);
      this.setLocal('exams', data.exams);
      if (data.sessions) this.setLocal('study_sessions', data.sessions);
      if (data.periods) this.setLocal('periods', data.periods);
      if (data.profile) this.setLocal('profile', data.profile);
      return true;
    } catch (err) {
      console.error('Error importing backup:', err);
      return false;
    }
  }
}

export const dataService = new DataService();
