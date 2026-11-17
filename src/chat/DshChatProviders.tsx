import type { ReactNode } from 'react';
import { ToolDetailsContext } from '../../../../shared/chat/DeferredToolDetails';
import { ProcessDetailsContext } from '../../../../shared/chat/DeferredProcessDetails';
import { DesktopUsageContext } from '../../../../shared/chat/DesktopUsageContext';
import { ImageAiContext } from '../../../../shared/chat/ImageAiContext';
import { ChatImageContext } from '../../../../shared/remote-chat/views/ChatImage';
import { ChatFileContext } from '../../../../shared/remote-chat/views/ChatFileLink';
import { ChatAttachmentMetadata } from '../../../../shared/remote-chat/views/ChatAttachmentMetadata';
import { ChatBrowserProvider } from '../../../../shared/remote-chat/views/ChatBrowserProvider';
import { ChatFileReferencesProvider } from '../../../../shared/chat/ChatFileReferences';
import { ImageAnnotationsProvider } from '../../../../shared/chat/ImageAnnotations';
import { ChatQuotesProvider } from '../../../../shared/remote-chat/views/ChatQuotes';
import { ChatDetailsWorkspace } from '../../../../shared/remote-chat/views/ChatDetailsWorkspace';
import { imageAiSender } from '../../../../shared/remote-chat/client/imageAiSender';
import { prepareImageEdit } from '../../../../shared/remote-chat/views/prepareImageEdit';
import { useVisibleChatUsage } from '../../../../shared/remote-chat/views/useVisibleChatUsage';
import { TaskReviewProvider } from '../../../../shared/remote-chat/TaskReviewContext';
import { ChatRetryProvider } from '../../../../shared/remote-chat/ChatRetryProvider';
import { ChatPresentation } from '../../../../shared/remote-chat/views/ChatPresentation';
import type { ChatController, ChatState } from '../../../../shared/remote-chat/views/types';

export function DshChatProviders({ controller, state, active, children }: {
  controller: ChatController; state: ChatState; active: boolean; children: ReactNode;
}) {
  const enabled = active && state.ready;
  const usage = useVisibleChatUsage(controller.readUsage, enabled);
  const threadId = state.selected?.id ?? null;
  return <ChatPresentation.Provider value={{ taskCards: true }}>
    <ToolDetailsContext.Provider value={{ load: controller.toolDetails, active: enabled }}>
    <ProcessDetailsContext.Provider value={{ load: controller.processDetails, active: enabled }}>
    <DesktopUsageContext.Provider value={usage}>
    <ImageAiContext.Provider value={{ enabled: enabled && !state.selectedArchived
      && !state.sending && !state.settingsBusy && !state.workspaceBusy && !state.compacting,
      send: imageAiSender(controller, prepareImageEdit) }}>
    <ChatImageContext.Provider value={{ threadId, ready: state.ready, load: controller.imagePreview,
      save: controller.managedPreviews ? controller.savePreviewImage : undefined }}>
    <ChatFileContext.Provider value={{ threadId, ready: state.ready,
      client: controller.files, load: controller.textPreview }}>
    <ChatAttachmentMetadata controller={controller} ready={state.ready} threadId={threadId}>
    <ChatBrowserProvider controller={controller}>
    <ChatFileReferencesProvider><ImageAnnotationsProvider>
    <ChatQuotesProvider scope={state.draftScope ?? threadId} sending={state.sending}
      enabled={enabled && !state.selectedArchived}>
    <ChatDetailsWorkspace selected={threadId} active={active} enabled>
    <TaskReviewProvider controller={controller} state={state} active={active}>
    <ChatRetryProvider controller={controller} state={state}>{children}</ChatRetryProvider>
    </TaskReviewProvider></ChatDetailsWorkspace>
    </ChatQuotesProvider></ImageAnnotationsProvider></ChatFileReferencesProvider>
    </ChatBrowserProvider></ChatAttachmentMetadata>
    </ChatFileContext.Provider></ChatImageContext.Provider></ImageAiContext.Provider>
    </DesktopUsageContext.Provider></ProcessDetailsContext.Provider>
  </ToolDetailsContext.Provider></ChatPresentation.Provider>;
}
