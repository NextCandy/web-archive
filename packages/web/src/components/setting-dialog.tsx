import { Label } from '@radix-ui/react-context-menu'
import { DialogDescription } from '@radix-ui/react-dialog'
import { Button } from '@web-archive/shared/components/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@web-archive/shared/components/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@web-archive/shared/components/select'
import { Switch } from '@web-archive/shared/components/switch'
import { useTheme } from '@web-archive/shared/components/theme-provider'
import { Archive, Download, Settings } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import LanguageCombobox from '@web-archive/shared/components/language-combobox'
import AITagSettingCollapsible from './ai-tag-setting-collapsible'
import { useShouldShowRecent } from '~/hooks/useShouldShowRecent'

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
}

function SettingDialog({ open, setOpen }: { open: boolean, setOpen: (open: boolean) => void }) {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { shouldShowRecent, updateShouldShowRecent } = useShouldShowRecent()
  const [exporting, setExporting] = useState(false)

  const handleDownloadUserscript = () => {
    const link = document.createElement('a')
    link.href = '/static/web-archive-tampermonkey.user.js'
    link.download = 'web-archive-tampermonkey.user.js'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const handleExportArchive = async () => {
    setExporting(true)
    try {
      const response = await fetch('/api/pages/export', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      })
      if (!response.ok) {
        const error = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(error?.message || t('export-archive-failed'))
      }
      downloadBlob(await response.blob(), `web-archive-export-${Date.now()}.zip`)
      toast.success(t('export-archive-success'))
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : t('export-archive-failed'))
    }
    finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader className="mb-4">
          <DialogTitle className="flex items-center">
            <Settings className="w-6 h-6 mr-2" />
            {t('settings')}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>
        </DialogDescription>
        <div className="space-y-4">
          <div className="flex items-center space-x-6">
            <Label className="font-bold">
              {t('color-theme')}
            </Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t('light')}</SelectItem>
                <SelectItem value="dark">{t('dark')}</SelectItem>
                <SelectItem value="system">{t('system')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-6">
            <Label className="font-bold">
              {t('language-web')}
            </Label>
            <div className="w-40">
              <LanguageCombobox></LanguageCombobox>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <Label className="font-bold">
              {t('show-recent-save-page')}
            </Label>
            <Switch
              checked={shouldShowRecent}
              onCheckedChange={updateShouldShowRecent}
            >
            </Switch>
          </div>
          <div className="space-y-2">
            <Label className="font-bold">
              {t('archive-tools')}
            </Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" className="justify-start" onClick={handleDownloadUserscript}>
                <Download className="mr-2 h-4 w-4" />
                {t('download-userscript')}
              </Button>
              <Button type="button" variant="outline" className="justify-start" disabled={exporting} onClick={handleExportArchive}>
                <Archive className="mr-2 h-4 w-4" />
                {exporting ? t('exporting-archive') : t('export-archive-zip')}
              </Button>
            </div>
          </div>
          <div>
            <AITagSettingCollapsible></AITagSettingCollapsible>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SettingDialog
