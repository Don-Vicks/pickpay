import { Composition } from 'remotion'
import { FPS, totalFrames } from './beats'
import { Demo } from './Video'

export function Root() {
  return (
    <>
      <Composition id="PickPayDemo" component={Demo} defaultProps={{ cut: 'full' as const }} durationInFrames={totalFrames('full')} fps={FPS} width={1920} height={1080} />
      <Composition id="PickPayShort" component={Demo} defaultProps={{ cut: 'short' as const }} durationInFrames={totalFrames('short')} fps={FPS} width={1920} height={1080} />
    </>
  )
}
