import { create } from 'zustand'
import { getLocalAssetUrl, getPathName } from '@/lib/localAsset'

export type SelectedImagePreview = {
  path: string
  name: string
  fileUrl: string
}

type ImagePreviewState = {
  selected: SelectedImagePreview | null
}

type ImagePreviewActions = {
  actions: {
    selectPath: (path: string) => void
    clear: () => void
  }
}

export const useImagePreviewStore = create<ImagePreviewState & ImagePreviewActions>((set) => ({
  selected: null,
  actions: {
    selectPath(path) {
      set({
        selected: {
          path,
          name: getPathName(path),
          fileUrl: getLocalAssetUrl(path),
        },
      })
    },
    clear() {
      set({ selected: null })
    },
  },
}))

export const useSelectedImagePreview = () => useImagePreviewStore((state) => state.selected)

export const useImagePreviewStoreActions = () => useImagePreviewStore((state) => state.actions)
