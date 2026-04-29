import * as React from 'react';
import { useAppAActionEvent, EVENT_TYPES } from '../shell/useActionEvent';
import { TestEmptyEventEvent, TestNameMappingEvent } from './avo/Avo';

const SAMPLE_QUERIES = ['burrito', 'cold brew', 'red wine', 'sparkling water', 'pasta'];

export const AppA = () => {
  const trackAction = useAppAActionEvent();

  const handleEmpty = () => {
    trackAction({ event: new TestEmptyEventEvent(), type: EVENT_TYPES.ACTION });
  };

  const handleSearch = () => {
    const query = SAMPLE_QUERIES[Math.floor(Math.random() * SAMPLE_QUERIES.length)] ?? 'pasta';
    const resultCount = Math.floor(Math.random() * 50);
    trackAction({
      event: new TestNameMappingEvent(query, undefined, resultCount, undefined, undefined),
      type: EVENT_TYPES.ACTION,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button data-testid="track-button" onClick={handleEmpty}>
        Track Empty Event (App A)
      </button>
      <button data-testid="track-button-search" onClick={handleSearch}>
        Track Search Submitted (App A)
      </button>
    </div>
  );
};
