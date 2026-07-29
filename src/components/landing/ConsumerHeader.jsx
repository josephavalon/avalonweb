import { Link } from 'react-router-dom';
import AvalonMark from '@/components/AvalonMark';

export default function ConsumerHeader() {
  return (
    <header className="nd-consumer-header">
      <Link to="/" className="nd-consumer-header__brand" aria-label="Avalon Vitality home">
        <AvalonMark className="nd-consumer-header__mark" />
        <span>Avalon Vitality</span>
      </Link>
    </header>
  );
}
