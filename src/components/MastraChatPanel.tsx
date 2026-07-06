import { useState, useCallback, useRef, useEffect } from 'react';
import { useMastra } from '@/hooks/useMastra';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Square, Plane, Wrench, Eye, X } from 'lucide-react';

interface MastraChatPanelProps {
  projectPath: string;
  onClose: () => void;
}

export function MastraChatPanel({ projectPath, onClose }: MastraChatPanelProps) {
  const { init, sendMessage, abort, switchMode, destroy, isInitialized, events, mode } = useMastra();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    init(projectPath);
    return () => { destroy(); };
  }, [projectPath, init, destroy]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending) return;
    setIsSending(true);
    await sendMessage(input.trim());
    setInput('');
    setIsSending(false);
  }, [input, isSending, sendMessage]);

  const handleAbort = useCallback(() => {
    abort();
    setIsSending(false);
  }, [abort]);

  const modeButtons = [
    { id: 'plan', label: 'Plan', icon: Plane },
    { id: 'build', label: 'Build', icon: Wrench },
    { id: 'review', label: 'Review', icon: Eye },
  ];

  return (
    <div className="flex flex-col h-full border rounded-lg bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Pilot (Mastra)</h3>
          <div className="flex gap-1">
            {modeButtons.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={mode === id ? 'default' : 'outline'}
                size="sm"
                onClick={() => switchMode(id)}
              >
                <Icon className="w-3 h-3 mr-1" />
                {label}
              </Button>
            ))}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!isInitialized && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Initializing Mastra...
          </div>
        )}
        {events.map((event: any, i: number) => (
          <div key={i} className="text-sm">
            {event.type === 'message_update' && (
              <div className="p-2 rounded bg-muted">
                {typeof event.message?.content === 'string'
                  ? event.message.content
                  : JSON.stringify(event.message)}
              </div>
            )}
            {event.type === 'tool_start' && (
              <div className="p-2 rounded bg-blue-500/10 text-blue-600">
                Tool: {event.toolName}
              </div>
            )}
            {event.type === 'tool_end' && (
              <div className="p-2 rounded bg-green-500/10 text-green-600">
                Tool complete: {event.toolName}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask Pilot..."
            disabled={!isInitialized || isSending}
          />
          {isSending ? (
            <Button variant="destructive" size="icon" onClick={handleAbort}>
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button size="icon" onClick={handleSend} disabled={!isInitialized || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
