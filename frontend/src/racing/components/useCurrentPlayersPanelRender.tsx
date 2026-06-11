import React, { useEffect } from 'react'
import { CurrentPlayersPanel, CurrentPlayersPanelProps } from './CurrentPlayersPanel'

interface UseCurrentPlayersPanelRenderOptions extends CurrentPlayersPanelProps {
  gameStatus: string
  onCurrentPlayersRender?: (jsx: React.ReactNode) => void
}

export const useCurrentPlayersPanelRender = ({
  gameStatus,
  onCurrentPlayersRender,
  ...panelProps
}: UseCurrentPlayersPanelRenderOptions): void => {
  useEffect(() => {
    if (!onCurrentPlayersRender) return

    onCurrentPlayersRender(<CurrentPlayersPanel {...panelProps} />)
  }, [
    gameStatus,
    onCurrentPlayersRender,
    panelProps.players,
    panelProps.socketId,
    panelProps.identityKey,
    panelProps.selectedPlayerColor,
    panelProps.selectedTrackName,
    panelProps.defaultTrackName,
    panelProps.ordinalAddress,
    panelProps.walletSaladCount,
    panelProps.walletBlueberryCount,
    panelProps.walletRabbitCount,
    panelProps.blueberryIconUrl,
    panelProps.saladIconUrl,
    panelProps.rabbitIconUrl
  ])
}
