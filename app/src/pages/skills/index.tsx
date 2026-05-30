import { useEffect, useState } from 'react'
import { ExternalLink, Sparkles } from 'lucide-react'
import { Button } from '@/app/src/ui/Button'

type Skill = {
  name: string
  description: string
  filePath: string
}

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [skillsPath, setSkillsPath] = useState('')

  useEffect(() => {
    window.ipcRendererApi.invoke('get-skills-list').then(setSkills)
    window.ipcRendererApi.invoke('workspace-get-info').then((info) => {
      setSkillsPath(info.skillsPath)
    })
  }, [])

  return (
    <div className='h-full overflow-auto'>
      <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 py-8'>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <div className='flex items-center gap-2 text-2xl font-semibold'>
              <Sparkles className='text-primary size-5' />
              Skills
            </div>
            <div className='text-text-info mt-1 text-sm'>{skillsPath}</div>
          </div>
          {skillsPath && (
            <Button
              variant='outline'
              size='sm'
              className='gap-2'
              onClick={() =>
                window.ipcRendererApi.invoke('reveal-path-in-explorer', { path: skillsPath })
              }
            >
              <ExternalLink className='size-4' />
              Open folder
            </Button>
          )}
        </div>

        <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
          {skills.map((skill) => (
            <button
              key={skill.filePath}
              type='button'
              onClick={() =>
                window.ipcRendererApi.invoke('reveal-path-in-explorer', { path: skill.filePath })
              }
              className='border-border hover:border-primary/50 hover:bg-foreground/5 flex flex-col gap-2 rounded-lg border p-4 text-left transition'
            >
              <div className='font-medium'>{skill.name}</div>
              <div className='text-text-secondary text-sm'>{skill.description}</div>
              <div className='text-text-info truncate text-xs'>{skill.filePath}</div>
            </button>
          ))}
        </div>

        {skills.length === 0 && (
          <div className='border-border text-text-secondary rounded-lg border p-6 text-sm'>
            No skills found.
          </div>
        )}
      </div>
    </div>
  )
}
