'use client'
import { useState, useMemo, useEffect } from 'react'
import { Column } from './components/Column'
import { CaptureDataProps, createNewActivity, DeskActivity } from './types/activity'
import { MOCK_ACTIVITIES } from './mockData' // Replace with Supabase fetch later
import { CAPTURE_LISTS, NEWSLETTER_LISTS, TRIAGE_LISTS, ListId } from './types/list'
import { ActivityDrawer } from './components/ActivityDrawer'
import { postDesk } from '../lib/PostToWebhook'

type Tab = 'capture' | 'triage' | 'newsletter' 

export default function Board() {
  // Responsive default tab: capture on mobile, triage on desktop
  const [activeTab, setActiveTab] = useState<Tab>('triage');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // NOW it is safe to check the window size
    if (window.innerWidth < 768) {
      setActiveTab('capture');
    }
  }, []);

  const [activities, setActivities] = useState<(DeskActivity)[]>(MOCK_ACTIVITIES)
  const [selectedActivity, setSelectedActivity] = useState<DeskActivity | null>(
    null
  )
  const [openCols, setOpenCols] = useState<Set<ListId>>(() => {
    // All columns expanded by default
    const allIds = [...CAPTURE_LISTS, ...TRIAGE_LISTS, ...NEWSLETTER_LISTS].map(col => col.id)
    return new Set(allIds)
  })

  // 1. Handlers
  const handleUpdateEvent = (updated: DeskActivity) => {
    setActivities((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    setSelectedActivity(null) // Close form after save
  }

  const handleMoveEvent = (id: string, targetList: ListId) => {
    setActivities((prev) =>
      prev.map((e) => (e.id === id ? { ...e, list_id: targetList } : e))
    )
  }

  // TODO
  const handleArchiveEvent = (id: string) => {
    setActivities((prev) =>
      prev.map((e) => (e.id === id ? { ...e, } : e))
    )
  }

 const handleAddEvent = async (captureData: CaptureDataProps) => {
    // 1. Generate local blob URL for instant UI image rendering (if a file exists)
    const preview_url = captureData.file 
      ? URL.createObjectURL(captureData.file) 
      : null;

    // 2. Leverage your factory to create the perfect optimistic activity
    // We explicitly pass the description, and tuck everything else into overrides
    const optimisticActivity: DeskActivity = createNewActivity(
      captureData.description || '', 
      {
        list_id: captureData.list_id || 'capture',
        file: captureData.file,
        preview_url: preview_url
      }
    );

    // 3. Update UI instantly with the clean object
    setActivities((prev) => [optimisticActivity, ...prev]);

    try {
      // 4. Package up data for your postDesk handler
      // Since postDesk likely handles the network fetch under the hood, 
      // pass the stable optimistic ID along so n8n can map back to it!
      const postData = { 
        ...captureData,
        id: optimisticActivity.id,
        action: 'add'
      };

      const result = await postDesk(postData);
      
      if (!result.success) {
        throw new Error(`Webhook failed with status ${result.status}`);
      }
      
      if (result.success) {
        console.log('Event submitted successfully');
        
        // TODO: Extract the hydrated activity returned by your server
        // const savedActivity = result.data; // e.g., contains the real database file_url
        
        // 2. Map through state and swap out the optimistic stub with the real record
        setActivities((prev) => 
          prev.map((e) => {
            if (e.id === optimisticActivity.id) {
              // Clean up the local blob URL memory before discarding the stub
              if (optimisticActivity.preview_url) {
                URL.revokeObjectURL(optimisticActivity.preview_url);
              }
              // return savedActivity; // The card now switches to the official DB data
            }
            return e;
          })
        );
      }
    } catch (err) {
      console.error('Capture Error:', err);
      
      // 5. Rollback UI on failure
      setActivities((prev) => prev.filter((e) => e.id !== optimisticActivity.id));
      
      // 6. Memory Cleanup: Immediately free up browser memory if a blob was created
      if (preview_url) {
        URL.revokeObjectURL(preview_url);
      }
      
      // Optional: add a toast notification or alert here for the user
    }
  };

  // 2. Determine which columns to show
  const currentColumns = activeTab === 'capture' ? CAPTURE_LISTS : activeTab === 'triage' ? TRIAGE_LISTS : NEWSLETTER_LISTS

  return (
    <main className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Tab Navigation */}
      <header className="bg-white border-b shadow-sm z-10">
        <h1 className="m-4 mb-2 text-2xl font-black text-slate-900 italic">
          The APP Desk
        </h1>
        <div className="flex px-4 gap-8">
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
      </header>

      {/* The Board Area */}
<div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-x-auto bg-slate-100 gap-2 p-2">
  {currentColumns.map((col) => (
    <div 
      key={col.id} 
      // w-full makes them stack on mobile
      // md:flex-1 md:basis-0 makes them 50/50 on desktop
      // min-w-0 prevents content from pushing the width out
      className="w-full md:flex-1 md:basis-0 min-w-0"
    >
      <Column
        list={col}
        isOpen={typeof window !== 'undefined' && window.innerWidth >= 768 ? true : openCols.has(col.id)}
        onToggle={() => {
          setOpenCols(prev => {
            const newSet = new Set(prev)
            if (newSet.has(col.id)) {
              newSet.delete(col.id)
            } else {
              newSet.add(col.id)
            }
            return newSet
          })
        }}
        activities={activities.filter((e) => e.list_id === col.id)}
        onDetails={setSelectedActivity}
        onMove={handleMoveEvent}
        onAddEvent={handleAddEvent}
        onArchive={handleArchiveEvent}
      />
    </div>
  ))}
</div>

      {/* Detail Overlay */}
      {selectedActivity && (
        <ActivityDrawer
          activity={selectedActivity}
          onSave={handleUpdateEvent}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </main>
  )
}
