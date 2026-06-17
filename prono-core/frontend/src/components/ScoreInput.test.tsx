import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScoreInput from './ScoreInput';

// ── rendu ─────────────────────────────────────────────────────────────────────

describe('ScoreInput — rendu', () => {
  it('affiche la valeur courante dans l\'input', () => {
    render(<ScoreInput value="3" onChange={vi.fn()} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(3);
  });

  it('affiche les boutons − et +', () => {
    render(<ScoreInput value="2" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Diminuer')).toBeInTheDocument();
    expect(screen.getByLabelText('Augmenter')).toBeInTheDocument();
  });

  it('applique inputClassName à l\'input', () => {
    render(<ScoreInput value="1" onChange={vi.fn()} inputClassName="my-class" />);
    expect(screen.getByRole('spinbutton').className).toContain('my-class');
  });

  it('passe le placeholder à l\'input', () => {
    render(<ScoreInput value="" onChange={vi.fn()} placeholder="0" />);
    expect(screen.getByPlaceholderText('0')).toBeInTheDocument();
  });

  it('marque l\'input comme required quand la prop est présente', () => {
    render(<ScoreInput value="0" onChange={vi.fn()} required />);
    expect(screen.getByRole('spinbutton')).toBeRequired();
  });

  it('ne marque pas l\'input comme required par défaut', () => {
    render(<ScoreInput value="0" onChange={vi.fn()} />);
    expect(screen.getByRole('spinbutton')).not.toBeRequired();
  });
});

// ── incrément / décrément ─────────────────────────────────────────────────────

describe('ScoreInput — incrément / décrément', () => {
  it('appelle onChange avec valeur+1 au clic +', async () => {
    const onChange = vi.fn();
    render(<ScoreInput value="5" onChange={onChange} max={20} />);
    await userEvent.click(screen.getByLabelText('Augmenter'));
    expect(onChange).toHaveBeenCalledWith('6');
  });

  it('appelle onChange avec valeur-1 au clic −', async () => {
    const onChange = vi.fn();
    render(<ScoreInput value="5" onChange={onChange} min={0} />);
    await userEvent.click(screen.getByLabelText('Diminuer'));
    expect(onChange).toHaveBeenCalledWith('4');
  });

  it('appelle onChange lors de la saisie clavier directe', async () => {
    const onChange = vi.fn();
    render(<ScoreInput value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('spinbutton'), '7');
    expect(onChange).toHaveBeenCalled();
  });

  it('appelle onChange avec 1 depuis une valeur vide au clic + (min=0)', async () => {
    const onChange = vi.fn();
    render(<ScoreInput value="" onChange={onChange} min={0} max={20} />);
    await userEvent.click(screen.getByLabelText('Augmenter'));
    expect(onChange).toHaveBeenCalledWith('1');
  });

  it('les boutons ne font pas soumettre de formulaire (type=button)', () => {
    const onSubmit = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <ScoreInput value="3" onChange={vi.fn()} />
      </form>,
    );
    screen.getByLabelText('Augmenter').click();
    screen.getByLabelText('Diminuer').click();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// ── bornes ────────────────────────────────────────────────────────────────────

describe('ScoreInput — bornes', () => {
  it('désactive le bouton + quand valeur === max', () => {
    render(<ScoreInput value="20" onChange={vi.fn()} max={20} />);
    expect(screen.getByLabelText('Augmenter')).toBeDisabled();
  });

  it('désactive le bouton − quand valeur === min', () => {
    render(<ScoreInput value="0" onChange={vi.fn()} min={0} />);
    expect(screen.getByLabelText('Diminuer')).toBeDisabled();
  });

  it('n\'appelle pas onChange si + est cliqué à max', async () => {
    const onChange = vi.fn();
    render(<ScoreInput value="20" onChange={onChange} max={20} />);
    await userEvent.click(screen.getByLabelText('Augmenter'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('n\'appelle pas onChange si − est cliqué à min', async () => {
    const onChange = vi.fn();
    render(<ScoreInput value="0" onChange={onChange} min={0} />);
    await userEvent.click(screen.getByLabelText('Diminuer'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('active le bouton + si valeur < max', () => {
    render(<ScoreInput value="19" onChange={vi.fn()} max={20} />);
    expect(screen.getByLabelText('Augmenter')).not.toBeDisabled();
  });

  it('active le bouton − si valeur > min', () => {
    render(<ScoreInput value="1" onChange={vi.fn()} min={0} />);
    expect(screen.getByLabelText('Diminuer')).not.toBeDisabled();
  });

  it('le bouton + est toujours actif si max n\'est pas défini', () => {
    render(<ScoreInput value="9999" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Augmenter')).not.toBeDisabled();
  });

  it('incrémente au-delà de valeurs élevées si aucun max', async () => {
    const onChange = vi.fn();
    render(<ScoreInput value="999" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Augmenter'));
    expect(onChange).toHaveBeenCalledWith('1000');
  });
});
