'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { fmtDataBR, lerDataBR, mascaraData, mensagemDaLeitura, mesmaData } from '@/lib/data-digitada';

// Campo de data digitável (pedido 24/11/2026), usado no DateField da
// Captação e no "De/Até" do filtro de Período. Controlado pela data, não
// pelo texto: só chama `onChange` com data válida (ou null ao apagar
// tudo). Enquanto o texto está pela metade ou é impossível (31/02), a
// data anterior fica valendo e o erro sobe por `onErro`.
export function InputData({
  value,
  onChange,
  onErro,
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: Date | null;
  onChange: (data: Date | null) => void;
  onErro?: (mensagem: string | null) => void;
}) {
  const [texto, setTexto] = useState(() => fmtDataBR(value));
  const [visto, setVisto] = useState(value);

  // Data mudou por fora (calendário, atalho, limpar): reescreve o texto,
  // a menos que ele já represente essa mesma data (ex.: "28/11/26"). O
  // erro de quem chamou é limpo por quem mudou a data (setState do pai
  // durante o render daqui daria aviso do React).
  if (!mesmaData(value, visto)) {
    setVisto(value);
    const atual = lerDataBR(texto);
    if (!mesmaData(atual.estado === 'ok' ? atual.data : null, value)) {
      setTexto(fmtDataBR(value));
    }
  }

  function digitar(bruto: string) {
    const novo = mascaraData(bruto);
    setTexto(novo);
    const l = lerDataBR(novo);
    if (l.estado === 'ok') {
      onErro?.(null);
      if (!mesmaData(l.data, value)) onChange(l.data);
    } else if (l.estado === 'vazia') {
      onErro?.(null);
      if (value) onChange(null);
    } else if (l.estado === 'invalida') {
      onErro?.(mensagemDaLeitura(l));
    } else {
      // incompleta: só reclama ao sair do campo, não a cada dígito
      onErro?.(null);
    }
  }

  function sair() {
    const l = lerDataBR(texto);
    if (l.estado === 'ok') setTexto(fmtDataBR(l.data)); // "28/11/26" vira "28/11/2026"
    onErro?.(mensagemDaLeitura(l));
  }

  const leitura = lerDataBR(texto);
  const invalido = leitura.estado === 'invalida';

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/aaaa"
      maxLength={10}
      {...props}
      value={texto}
      aria-invalid={invalido || props['aria-invalid'] || undefined}
      onChange={(e) => digitar(e.target.value)}
      onBlur={(e) => {
        sair();
        props.onBlur?.(e);
      }}
      className={cn('tabular-nums', className)}
    />
  );
}
