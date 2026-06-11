import { Dispatch, RefObject, SetStateAction, useCallback } from 'react'
import { RACING_CHAT_MESSAGE_MAX_LENGTH } from './RacingChatInputBar'

interface ChatSocket {
  emit(event: 'playerChat', payload: { message: string }): unknown
}

interface LocalChatMessage {
  text: string
  timestamp: number
}

interface UseRacingChatSenderOptions {
  chatInput: string
  setChatInput: Dispatch<SetStateAction<string>>
  setLocalChatMessage: Dispatch<SetStateAction<LocalChatMessage | null>>
  socketRef: RefObject<ChatSocket | null>
  hasJoined: boolean
  maxLength?: number
}

export const buildOutgoingChatMessage = (
  input: string,
  maxLength = RACING_CHAT_MESSAGE_MAX_LENGTH
): string | null => {
  const trimmed = input.trim()
  if (!trimmed) return null

  return trimmed.substring(0, maxLength)
}

export const useRacingChatSender = ({
  chatInput,
  setChatInput,
  setLocalChatMessage,
  socketRef,
  hasJoined,
  maxLength = RACING_CHAT_MESSAGE_MAX_LENGTH
}: UseRacingChatSenderOptions) => {
  return useCallback(() => {
    const message = buildOutgoingChatMessage(chatInput, maxLength)
    if (!message || !socketRef.current || !hasJoined) return

    socketRef.current.emit('playerChat', { message })
    setLocalChatMessage({ text: message, timestamp: Date.now() })
    setChatInput('')
  }, [chatInput, hasJoined, maxLength, setChatInput, setLocalChatMessage, socketRef])
}
