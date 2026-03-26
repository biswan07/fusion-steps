import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore'
import { db } from '../firebase'
import type { Video, DanceStyle } from '../types'

function toVideo(id: string, data: any): Video {
  return { id, ...data, uploadedAt: data.uploadedAt?.toDate() || new Date() }
}

function sortByUploadDesc(videos: Video[]) {
  return videos.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
}

export function useVideos(style?: DanceStyle, maxResults = 50) {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db) return
    // Use simple query without orderBy to avoid composite index requirement
    const constraints = style
      ? [where('style', '==', style), limit(maxResults)]
      : [limit(maxResults)]
    const q = query(collection(db, 'videos'), ...constraints)
    const unsubscribe = onSnapshot(q, (snap) => {
      setVideos(sortByUploadDesc(snap.docs.map((d) => toVideo(d.id, d.data()))))
      setLoading(false)
    }, (err) => {
      console.error('useVideos error:', err)
      setLoading(false)
    })
    return unsubscribe
  }, [style, maxResults])

  return { videos, loading }
}

export function useBatchVideos(batchIds: string[], style?: DanceStyle) {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db || batchIds.length === 0) {
      setVideos([])
      setLoading(false)
      return
    }
    const q = query(
      collection(db, 'videos'),
      where('batchIds', 'array-contains-any', batchIds.slice(0, 10)),
      limit(50)
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      let vids = snap.docs.map((d) => toVideo(d.id, d.data()))
      if (style) vids = vids.filter((v) => v.style === style)
      setVideos(sortByUploadDesc(vids))
      setLoading(false)
    }, (err) => {
      console.error('useBatchVideos error:', err)
      setLoading(false)
    })
    return unsubscribe
  }, [batchIds.join(','), style])

  return { videos, loading }
}
