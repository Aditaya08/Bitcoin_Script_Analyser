import { ScriptType } from '@/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const typeClassMap: Record<ScriptType, string> = {
  P2TR: 'bg-purple-900 text-purple-200 border-purple-700',
  P2WPKH: 'bg-blue-900 text-blue-200 border-blue-700',
  P2PKH: 'bg-amber-900 text-amber-200 border-amber-700',
  P2SH: 'bg-teal-900 text-teal-200 border-teal-700',
  P2MS: 'bg-coral-900 text-coral-200 border-coral-700',
  OP_RETURN: 'bg-gray-700 text-gray-300 border-gray-600',
  NONSTANDARD: 'bg-red-900 text-red-200 border-red-700',
  P2PK: 'bg-indigo-900 text-indigo-200 border-indigo-700',
  P2WSH: 'bg-sky-900 text-sky-200 border-sky-700',
};

export function ScriptTypeTag({ scriptType }: { scriptType: ScriptType }) {
  return (
    <Badge
      variant="outline"
      className={cn('font-mono text-[11px] uppercase tracking-wide', typeClassMap[scriptType])}
    >
      {scriptType}
    </Badge>
  );
}
