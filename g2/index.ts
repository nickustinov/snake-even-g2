import { createSnakeActions } from './main'
import type { AppModule } from '../_shared/app-types'

export const app: AppModule = {
  id: 'snake',
  name: 'Snake',
  pageTitle: 'Snake',
  autoConnect: true,
  initialStatus: 'Snake ready',
  createActions: createSnakeActions,
}

export default app
