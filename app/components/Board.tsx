'use client';

import { useState, useEffect } from 'react'
import { Column } from './Column'
import { CaptureDataProps, createNewActivity, DeskActivity } from '../types/activity'
import { CAPTURE_LISTS, NEWSLETTER_LISTS, TRIAGE_LISTS, ListId, Tab } from '../types/list'
import { ActivityDrawer } from './ActivityDrawer'
import { postDesk } from '../../lib/PostToWebhook'
import { archiveActivity, moveActivity, saveActivity } from '../actions/activities'
import { Calendar } from 'lucide-react'

const LS_KEY = 'app_desk_newsletter_publish_date'
const DEFAULT_PUBLISH_DATE = '2026-05-18'

interface BoardProps {
  initialActivities: DeskActivity[];
}

export default function Board({ initialActivities } : BoardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('triage');
  const [publishDate, setPublishDate] = useState<string>(DEFAULT_PUBLISH_DATE);

  useEffect(() => {
    if (window.innerWidth < 768) setActiveTab('capture');
    const saved = localStorage.getItem(LS_KEY);
    if (saved) setPublishDate(saved);
  }, []);

  const handlePublishDateChange = (date: string) => {
    setPublishDate(date);
    localStorage.setItem(LS_KEY, date);
  };

  const [activities, setActivities] = useState<DeskActivity[]>(initialActivities)
  const [selectedActivity, setSelectedActivity] = useState<DeskActivity | null>(null)
  const [openCols, setOpenCols] = useState<Set<ListId>>(() => {
    const allIds = [...CAPTURE_LISTS, ...TRIAGE_LISTS, ...NEWSLETTER_LISTS].map(col => col.id)
    return new Set(allIds)
  })

  const handleSaveDraft = async (updated: DeskActivity) => {
    const withStatus = { ...updated, status: 'edited' as const }
    setActivities(prev => prev.map(e => e.id === updated.id ? withStatus : e))
    setSelectedActivity(null)
    try {
      await saveActivity(updated.id, updated.type, withStatus)
    } catch (err) {
      console.error('Save draft failed:', err)
    }
  }

  const handleFinishEditing = async (updated: DeskActivity) => {
    const targetList: ListId = updated.type === 'event' ? 'upcoming_events' : 'new_resources'
    const withListAndStatus = { ...updated, list_id: targetList, status: 'edited' as const }
    setActivities(prev => prev.map(e => e.id === updated.id ? withListAndStatus : e))
    setSelectedActivity(null)
    try {
      await saveActivity(updated.id, updated.type, withListAndStatus)
    } catch (err) {
      console.error('Finish editing failed:', err)
    }
  }

  const handleMoveEvent = async (id: string, targetList: ListId) => {
    setActivities(prev => prev.map(e => e.id === id ? { ...e, list_id: targetList } : e))
    const activity = activities.find(e => e.id === id)
    if (!activity) return
    try {
      await moveActivity(id, activity.type, targetList)
    } catch (err) {
      console.error('Move failed:', err)
      // Roll back optimistic update
      setActivities(prev => prev.map(e => e.id === id ? { ...e, list_id: activity.list_id } : e))
    }
  }

  const handleArchiveEvent = async (id: string) => {
    const activity = activities.find(e => e.id === id)
    if (!activity) return
    setActivities(prev => prev.map(e => e.id === id ? { ...e, status: 'archived' as const } : e))
    try {
      await archiveActivity(id, activity.type)
    } catch (err) {
      console.error('Archive failed:', err)
      setActivities(prev => prev.map(e => e.id === id ? { ...e, status: activity.status } : e))
    }
  }

  const handleAddEvent = async (captureData: CaptureDataProps) => {
    const preview_url = captureData.file
      ? URL.createObjectURL(captureData.file)
      : null;

    const optimisticActivity: DeskActivity = createNewActivity(
      captureData.description || '',
      {
        list_id: captureData.list_id || 'capture',
        file: captureData.file,
        preview_url: preview_url,
      }
    );

    setActivities(prev => [optimisticActivity, ...prev]);

    try {
      const postData = {
        ...captureData,
        id: optimisticActivity.id,
        action: 'add' as const,
      };

      const result = await postDesk(postData);

      if (!result.success) {
        throw new Error(`Webhook failed with status ${result.status}`);
      }

      let processedData = result.data as DeskActivity
      processedData.list_id = 'review'

      setActivities(prev =>
        prev.map(e => {
          if (e.id === optimisticActivity.id) {
            if (optimisticActivity.preview_url && e.file_url) {
              URL.revokeObjectURL(optimisticActivity.preview_url);
            }
            return processedData;
          }
          return e;
        })
      );
    } catch (err) {
      console.error('Capture Error:', err);
      setActivities(prev => prev.filter(e => e.id !== optimisticActivity.id));
      if (preview_url) URL.revokeObjectURL(preview_url);
    }
  };

  const currentColumns = activeTab === 'capture' ? CAPTURE_LISTS : activeTab === 'triage' ? TRIAGE_LISTS : NEWSLETTER_LISTS

  return (
    <main className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden">
      <header className="m-4 mb-2 bg-white border-b shadow-sm z-10">
        <div>
          <h1 className="text-2xl font-black text-slate-900 italic">
            The APP Desk
          </h1>
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <p className="text-xs font-mono text-emerald-600 mt-1 bg-emerald-50 px-2.5 py-1 rounded-md inline-block">
              ● Secure Token Active (RLS Bypassed)
            </p>
          </div>
        </div>
        <div className="flex px-4 gap-8 items-center justify-between">
          <div className="flex gap-8">
            {(['capture', 'triage', 'newsletter'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 text-sm font-black uppercase tracking-widest transition-all ${
                  activeTab === tab
                    ? 'text-blue-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={12} className="text-slate-400" />
            <label className="text-[9px] font-black uppercase tracking-widest text-green-600">Next newsletter</label>
            <input
              type="date"
              value={publishDate}
              onChange={(e) => handlePublishDateChange(e.target.value)}
              className="text-xs font-bold text-slate-700 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-x-auto bg-slate-100 gap-2 p-2">
        {currentColumns.map((col) => (
          <div
            key={col.id}
            className="w-full md:flex-1 md:basis-0 min-w-0"
          >
            <Column
              list={col}
              isOpen={typeof window !== 'undefined' && window.innerWidth >= 768 ? true : openCols.has(col.id)}
              onToggle={() => {
                setOpenCols(prev => {
                  const newSet = new Set(prev)
                  if (newSet.has(col.id)) newSet.delete(col.id)
                  else newSet.add(col.id)
                  return newSet
                })
              }}
              activities={activities
                .filter(e => e.list_id === col.id && e.status !== 'archived')
                .sort((a, b) => {
                  if (!a.start_date && !b.start_date) return 0
                  if (!a.start_date) return 1
                  if (!b.start_date) return -1
                  return a.start_date.localeCompare(b.start_date)
                })
              }
              onDetails={setSelectedActivity}
              onMove={handleMoveEvent}
              onAddEvent={handleAddEvent}
              onArchive={handleArchiveEvent}
              publishDate={publishDate}
            />
          </div>
        ))}
      </div>

      {selectedActivity && (
        <ActivityDrawer
          activity={selectedActivity}
          onSaveDraft={handleSaveDraft}
          onFinishEditing={handleFinishEditing}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </main>
  )
}
