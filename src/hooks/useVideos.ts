import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase'
import type { Video, DanceStyle } from '../types'

function toVideo(id: string, data: any): Video {
  return { id, ...data, uploadedAt: data.uploadedAt?.toDate() || new Date() }
}

export function useVideos(style?: DanceStyle, maxResults = 50) {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db) return
    const constraints = style
      ? [where('style', '==', style), orderBy('uploadedAt', 'desc'), limit(maxResults)]
      : [orderBy('uploadedAt', 'desc'), limit(maxResults)]
    const q = query(collection(db, 'videos'), ...constraints)
    const unsubscribe = onSnapshot(q, (snap) => {
      setVideos(snap.docs.map((d) => toVideo(d.id, d.data())))
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
    const constraints = [
      where('batchIds', 'array-contains-any', batchIds.slice(0, 10)),
      orderBy('uploadedAt', 'desc'),
      limit(50),
    ]
    const q = query(collection(db, 'videos'), ...constraints)
    const unsubscribe = onSnapshot(q, (snap) => {
      let vids = snap.docs.map((d) => toVideo(d.id, d.data()))
      if (style) vids = vids.filter((v) => v.style === style)
      setVideos(vids)
      setLoading(false)
    })
    return unsubscribe
  }, [batchIds.join(','), style])

  return { videos, loading }
}
