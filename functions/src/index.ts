import * as admin from 'firebase-admin'
admin.initializeApp()

export { createStudent } from './createStudent'
export { onAttendanceCreated } from './onAttendanceCreated'
export { onVideoCreated } from './onVideoCreated'
