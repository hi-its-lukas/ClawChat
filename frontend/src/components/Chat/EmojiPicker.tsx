import React from 'react';

const EMOJIS = ['👍', '👎', '❤️', '😂', '🎉', '🤔', '👀', '🔥', '✅', '❌', '🚀', '💯', '👏', '🙏', '😍', '🤝'];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  return (
    <div className="bg-slate-700 rounded-lg shadow-xl border border-slate-600 p-2 w-[200px]">
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="w-6 h-6 flex items-center justify-center hover:bg-slate-600 rounded text-sm"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
