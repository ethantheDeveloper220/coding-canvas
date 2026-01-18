"use client"

import { useEffect, useRef } from "react"
import Editor, { type Monaco } from "@monaco-editor/react"
import type { editor } from "monaco-editor"

interface MonacoEditorProps {
  value: string
  onChange?: (value: string | undefined) => void
  language?: string
  readOnly?: boolean
  theme?: "vs-dark" | "light"
  height?: string
  onSave?: () => void
}

export function MonacoEditor({
  value,
  onChange,
  language = "typescript",
  readOnly = false,
  theme = "vs-dark",
  height = "100%",
  onSave,
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !onSave) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        onSave()
      }
    }

    const disposable = editor.onKeyDown(handleKeyDown)
    return () => {
      disposable?.dispose()
    }
  }, [onSave])

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor
    
    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: true },
      fontSize: 14,
      lineNumbers: "on",
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: "on",
      formatOnPaste: true,
      formatOnType: true,
    })

    // Add save keyboard shortcut hint
    if (onSave) {
      monaco.editor.addKeybindingRule({
        keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        command: "save",
      })
    }
  }

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      onChange={onChange}
      theme={theme}
      onMount={handleEditorDidMount}
      options={{
        readOnly,
        minimap: { enabled: true },
        fontSize: 14,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: "on",
        formatOnPaste: true,
        formatOnType: true,
      }}
    />
  )
}
