import type { Metadata } from 'next'
import './globals.css'
import { SCENE_REGISTRY }    from '@/app/lib/scenes/registry'
import StartScreen           from '@/app/components/ui/StartScreen'
import FullscreenBtn         from '@/app/components/ui/FullscreenBtn'
import CustomCursor          from '@/app/components/ui/CustomCursor'
import TorchCanvas           from '@/app/components/canvas/TorchCanvas'
import SiteTitle             from '@/app/components/ui/SiteTitle'
import SceneUI               from '@/app/components/scene/SceneUI'
import SceneAudio            from '@/app/components/scene/SceneAudio'
import NavigationController  from '@/app/components/navigation/NavigationController'
import MediaPlayerProvider from './components/ui/MediaPlayerProvider'
import Chapitre2Scene from './components/scene/Chapitre2Scene'

export const metadata: Metadata = {
  title: 'Soliman el-Halabi — Abounaddara × CNRS × 2026',
  description: 'Expérience interactive',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div id="app">
          {Object.values(SCENE_REGISTRY).map(scene => (
            <div key={scene.id} className="bg-layer" id={scene.background} />
          ))}

          <div id="veil" />
          <TorchCanvas />
          <SiteTitle />
          <SceneUI />
          <FullscreenBtn />
          <StartScreen />
          {children}
        </div>

        <div id="cursor" />
        <CustomCursor />

        {/* Singletons sans rendu — montés une seule fois */}
        <NavigationController />
        <SceneAudio />
        <MediaPlayerProvider />
        <Chapitre2Scene />
      </body>
    </html>
  )
}