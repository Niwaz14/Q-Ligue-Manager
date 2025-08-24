import React, { useState, useEffect } from 'react';
import styles from './MatchPlayQualification.module.css';

const MatchPlayQualification = () => {
  const [qualifiedHandicap, setQualifiedHandicap] = useState([]);
  const [qualifiedNoHandicap, setQualifiedNoHandicap] = useState([]);
  const [champions, setChampions] = useState([]);

  useEffect(() => {
    // This function would ideally be on the backend to process raw game data
    // and return the qualified players based on the complex rules.
    const processQualificationData = (rawData) => {
      // Dummy processing for demonstration. In a real scenario, this would involve:
      // 1. Calculating total scores (with/without handicap) for each player's triple.
      // 2. Sorting players for both handicap and no-handicap categories.
      // 3. Handling duplicates (player appearing in both lists) by keeping the highest rank.
      // 4. Applying tie-breaking rules (highest single game without handicap).
      // 5. Limiting to the top 15 for each category.

      // For now, we'll just use a simplified version of the dummy data
      // that already reflects the desired output structure.

      const dummyHandicap = [
        { rank: 1, name: 'Player A', handicap: 10, total: 750, gameScores: [250, 250, 250] },
        { rank: 2, name: 'Player B', handicap: 15, total: 745, gameScores: [240, 250, 255] },
        { rank: 3, name: 'Player C', handicap: 5, total: 740, gameScores: [245, 240, 255] },
        { rank: 4, name: 'Player D', handicap: 20, total: 735, gameScores: [230, 250, 255] },
        { rank: 5, name: 'Player E', handicap: 12, total: 730, gameScores: [240, 240, 250] },
        { rank: 6, name: 'Player F', handicap: 8, total: 725, gameScores: [235, 240, 250] },
        { rank: 7, name: 'Player G', handicap: 18, total: 720, gameScores: [220, 250, 250] },
        { rank: 8, name: 'Player H', handicap: 7, total: 715, gameScores: [230, 240, 245] },
        { rank: 9, name: 'Player I', handicap: 10, total: 710, gameScores: [225, 240, 245] },
        { rank: 10, name: 'Player J', handicap: 15, total: 705, gameScores: [210, 240, 255] },
        { rank: 11, name: 'Player K', handicap: 5, total: 700, gameScores: [220, 240, 240] },
        { rank: 12, name: 'Player L', handicap: 20, total: 695, gameScores: [200, 240, 255] },
        { rank: 13, name: 'Player M', handicap: 12, total: 690, gameScores: [210, 240, 240] },
        { rank: 14, name: 'Player N', handicap: 8, total: 685, gameScores: [205, 240, 240] },
        { rank: 15, name: 'Player O', handicap: 18, total: 680, gameScores: [190, 240, 250] },
      ];

      const dummyNoHandicap = [
        { rank: 1, name: 'Player P', handicap: 0, total: 760, gameScores: [260, 250, 250] },
        { rank: 2, name: 'Player Q', handicap: 0, total: 755, gameScores: [250, 250, 255] },
        { rank: 3, name: 'Player R', handicap: 0, total: 750, gameScores: [255, 240, 255] },
        { rank: 4, name: 'Player S', handicap: 0, total: 745, gameScores: [240, 250, 255] },
        { rank: 5, name: 'Player T', handicap: 0, total: 740, gameScores: [250, 240, 250] },
        { rank: 6, name: 'Player U', handicap: 0, total: 735, gameScores: [245, 240, 250] },
        { rank: 7, name: 'Player V', handicap: 0, total: 730, gameScores: [230, 250, 250] },
        { rank: 8, name: 'Player W', handicap: 0, total: 725, gameScores: [240, 240, 245] },
        { rank: 9, name: 'Player X', handicap: 0, total: 720, gameScores: [235, 240, 245] },
        { rank: 10, name: 'Player Y', handicap: 0, total: 715, gameScores: [220, 240, 255] },
        { rank: 11, name: 'Player Z', handicap: 0, total: 710, gameScores: [230, 240, 240] },
        { rank: 12, name: 'Player AA', handicap: 0, total: 705, gameScores: [210, 240, 255] },
        { rank: 13, name: 'Player BB', handicap: 0, total: 700, gameScores: [220, 240, 240] },
        { rank: 14, name: 'Player CC', handicap: 0, total: 695, gameScores: [215, 240, 240] },
        { rank: 15, name: 'Player DD', handicap: 0, total: 690, gameScores: [200, 240, 250] },
      ];

      // For the first week, this array would be empty.
      const dummyChampions = [
        'Champion 1',
        'Champion 2',
        'Champion 3',
        'Champion 4',
        'Champion 5',
        'Champion 6',
        'Champion 7',
        'Champion 8',
        'Champion 9',
        'Champion 10',
      ];

      return { dummyHandicap, dummyNoHandicap, dummyChampions };
    };

    const fetchQualificationData = async () => {
      // In a real application, this would be an API call to your backend
      // const response = await fetch('/api/matchplay/qualification');
      // const rawData = await response.json();

      // For now, we simulate fetching raw data and then processing it.
      const rawData = {}; // Placeholder for actual raw data from backend
      const { dummyHandicap, dummyNoHandicap, dummyChampions } = processQualificationData(rawData);

      setQualifiedHandicap(dummyHandicap);
      setQualifiedNoHandicap(dummyNoHandicap);
      setChampions(dummyChampions);
    };

    fetchQualificationData();
  }, []);

  return (
    <div className={styles.container}>
      <h1>Match Play Qualification</h1>

      <section className={styles.section}>
        <h2>Qualified Players (With Handicap)</h2>
        {qualifiedHandicap.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player Name</th>
                <th>Handicap</th>
                <th>Total (Triple)</th>
              </tr>
            </thead>
            <tbody>
              {qualifiedHandicap.map((player, index) => (
                <tr key={index}>
                  <td>{player.rank}</td>
                  <td>{player.name}</td>
                  <td>{player.handicap}</td>
                  <td>{player.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No players qualified with handicap this week.</p>
        )}
      </section>

      <section className={styles.section}>
        <h2>Qualified Players (Without Handicap)</h2>
        {qualifiedNoHandicap.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player Name</th>
                <th>Total (Triple)</th>
              </tr>
            </thead>
            <tbody>
              {qualifiedNoHandicap.map((player, index) => (
                <tr key={index}>
                  <td>{player.rank}</td>
                  <td>{player.name}</td>
                  <td>{player.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No players qualified without handicap this week.</p>
        )}
      </section>

      <section className={styles.section}>
        <h2>Additional Champions</h2>
        {champions.length > 0 ? (
          <ul className={styles.championsList}>
            {champions.map((champion, index) => (
              <li key={index}>{champion}</li>
            ))}
          </ul>
        ) : (
          <p>No additional champions this week.</p>
        )}
      </section>
    </div>
  );
};

export default MatchPlayQualification;