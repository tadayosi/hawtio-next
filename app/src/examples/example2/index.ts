
import { hawtio } from '@hawtio/react'
import { Example2 } from './Example2'

export const registerExample2 = () => {
  hawtio.addPlugin({
    id: 'example2',
    title: 'Example 2',
    path: '/example2',
    component: Example2,
    isActive: async () => true
  })
}