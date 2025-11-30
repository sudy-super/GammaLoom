import { MixCanvas } from '@renderer/shared/components/MixCanvas'
import { useElectronRealtime } from '@renderer/shared/hooks/useElectronRealtime'

export const ProjectionApp = () => {
  const { mixState } = useElectronRealtime('viewer')

  return (
    <div className="projection-app">
      <MixCanvas mixState={mixState} className="projection-app__canvas" />
      {!mixState && <div className="projection-app__overlay">Waiting for controller…</div>}
    </div>
  )
}
