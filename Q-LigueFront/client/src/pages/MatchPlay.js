import React, { useState, useEffect } from 'react';
import styles from './MatchPlay.module.css';

const MatchPlay = () => {
  const [brackets, setBrackets] = useState([]);

  useEffect(() => {
    // TODO: Replace with actual API call to fetch matchplay bracket data
    // Example API endpoint: /api/matchplay/games
    const fetchBracketData = async () => {
      // Dummy data for demonstration
      const dummyBrackets = [
        {
          category: 'Handicap Bracket 1',
          lane: 'Lanes 5-6',
          matches: [
            {
              id: 1,
              player1: { name: 'Player A', handicap: 10, score: 200 },
              player2: { name: 'Player B', handicap: 15, score: 190 },
              winner: 'Player A',
              prize: '$' + 50,
            },
            {
              id: 2,
              player1: { name: 'Player A', handicap: 10, score: 210 },
              player2: { name: 'Player C', handicap: 5, score: 205 },
              winner: 'Player A',
              prize: '$' + 100,
            },
            {
              id: 3,
              player1: { name: 'Player A', handicap: 10, score: 220 },
              player2: { name: 'Player D', handicap: 20, score: 215 },
              winner: 'Player A',
              prize: '$' + 200,
            },
          ],
          champion: 'Player A',
        },
        {
          category: 'Handicap Bracket 2',
          lane: 'Lanes 7-8',
          matches: [
            {
              id: 4,
              player1: { name: 'Player E', handicap: 12, score: 180 },
              player2: { name: 'Player F', handicap: 8, score: 185 },
              winner: 'Player F',
              prize: '$' + 50,
            },
            {
              id: 5,
              player1: { name: 'Player F', handicap: 8, score: 190 },
              player2: { name: 'Player G', handicap: 18, score: 170 },
              winner: 'Player F',
              prize: '$' + 100,
            },
            {
              id: 6,
              player1: { name: 'Player F', handicap: 8, score: 200 },
              player2: { name: 'Player H', handicap: 7, score: 195 },
              winner: 'Player F',
              prize: '$' + 200,
            },
          ],
          champion: 'Player F',
        },
        {
          category: 'No Handicap Bracket 1',
          lane: 'Lanes 9-10',
          matches: [
            {
              id: 7,
              player1: { name: 'Player I', handicap: 0, score: 230 },
              player2: { name: 'Player J', handicap: 0, score: 225 },
              winner: 'Player I',
              prize: '$' + 50,
            },
            {
              id: 8,
              player1: { name: 'Player I', handicap: 0, score: 240 },
              player2: { name: 'Player K', handicap: 0, score: 235 },
              winner: 'Player I',
              prize: '$' + 100,
            },
            {
              id: 9,
              player1: { name: 'Player I', handicap: 0, score: 250 },
              player2: { name: 'Player L', handicap: 0, score: 245 },
              winner: 'Player I',
              prize: '$' + 200,
            },
          ],
          champion: 'Player I',
        },
        {
          category: 'No Handicap Bracket 2',
          lane: 'Lanes 11-12',
          matches: [
            {
              id: 10,
              player1: { name: 'Player M', handicap: 0, score: 210 },
              player2: { name: 'Player N', handicap: 0, score: 215 },
              winner: 'Player N',
              prize: '$' + 50,
            },
            {
              id: 11,
              player1: { name: 'Player N', handicap: 0, score: 220 },
              player2: { name: 'Player O', handicap: 0, score: 210 },
              winner: 'Player N',
              prize: '$' + 100,
            },
            {
              id: 12,
              player1: { name: 'Player N', handicap: 0, score: 230 },
              player2: { name: 'Player P', handicap: 0, score: 225 },
              winner: 'Player N',
              prize: '$' + 200,
            },
          ],
          champion: 'Player N',
        },
        {
          category: 'No Handicap Bracket 3',
          lane: 'Lanes 13-14',
          matches: [
            {
              id: 13,
              player1: { name: 'Player Q', handicap: 0, score: 200 },
              player2: { name: 'Player R', handicap: 0, score: 205 },
              winner: 'Player R',
              prize: '$' + 50,
            },
            {
              id: 14,
              player1: { name: 'Player R', handicap: 0, score: 210 },
              player2: { name: 'Player S', handicap: 0, score: 200 },
              winner: 'Player R',
              prize: '$' + 100,
            },
            {
              id: 15,
              player1: { name: 'Player R', handicap: 0, score: 220 },
              player2: { name: 'Player T', handicap: 0, score: 215 },
              winner: 'Player R',
              prize: '$' + 200,
            },
          ],
          champion: 'Player R',
        },
      ];

      setBrackets(dummyBrackets);
    };

    fetchBracketData();
  }, []);

  return (
    <div className={styles.container}>
      <h1>Match Play Games</h1>

      {brackets.length > 0 ? (
        <div className={styles.bracketsGrid}>
          {brackets.map((bracket, index) => (
            <div key={index} className={styles.bracketCard}>
              <h2>{bracket.category}</h2>
              <p><strong>Lane:</strong> {bracket.lane}</p>
              <div className={styles.matchesContainer}>
                {bracket.matches.map((match) => (
                  <div key={match.id} className={styles.matchItem}>
                    <p><strong>Match {match.id}:</strong></p>
                    <p>{match.player1.name} ({match.player1.handicap}) vs {match.player2.name} ({match.player2.handicap})</p>
                    <p>Score: {match.player1.score} - {match.player2.score}</p>
                    <p>Winner: {match.winner}</p>
                    <p>Prize: {match.prize}</p>
                  </div>
                ))}
              </div>
              <h3>Champion: {bracket.champion}</h3>
            </div>
          ))}
        </div>
      ) : (
        <p>No match play games available this week.</p>
      )}
    </div>
  );
};

export default MatchPlay;