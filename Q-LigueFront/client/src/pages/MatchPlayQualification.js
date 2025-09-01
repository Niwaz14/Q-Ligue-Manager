import React, { useState, useEffect, useMemo } from 'react';
import { MaterialReactTable } from 'material-react-table';
import styles from './MatchPlayQualification.module.css';

const MatchPlayQualification = () => {
    const [weeks, setWeeks] = useState([]);
    const [selectedWeek, setSelectedWeek] = useState('');
    const [qualificationData, setQualificationData] = useState({
        withHandicap: [],
        withoutHandicap: [],
        champions: [],
    });
    const [loading, setLoading] = useState(true);
    const [championsLoading, setChampionsLoading] = useState(true); // -- A REVOIR REDONDANT --

    // Charger la liste des semaines.
    useEffect(() => {
        const fetchScheduleForWeeks = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule`);
                const data = await response.json();
                const uniqueWeekData = Array.from(new Map(data.map(item => [item.weekid, { number: item.weekid, date: new Date(item.weekdate).toLocaleDateString('fr-CA') }])).values())
                                            .sort((a, b) => a.number - b.number);
                setWeeks(uniqueWeekData);
                // Sélectionne la dernière semaine par défaut.
                if (uniqueWeekData.length > 0) {
                    setSelectedWeek(String(uniqueWeekData[uniqueWeekData.length - 1].number));
                }
            } catch (error) {
                console.error("Error fetching schedule for weeks:", error);
            }
        };
        fetchScheduleForWeeks();
    }, []);

    // Semaine changement
    useEffect(() => {
        if (!selectedWeek) return;

        const fetchQualificationData = async () => {
            setLoading(true);
            setChampionsLoading(true);
            try {
                // Appel à une route API spécifique pour les données de qualification.
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/matchplay/qualification/${selectedWeek}`);
                const data = await response.json();
                setQualificationData(data);
            } catch (error) {
                console.error('Error fetching qualification data:', error);
                setQualificationData({ withHandicap: [], withoutHandicap: [], champions: [] }); 
            } finally {
                setLoading(false);
                setChampionsLoading(false);
            }
        };

        fetchQualificationData();
    }, [selectedWeek]);

    // Détermine le bracket d'un joueur en fonction de son rang et de la semaine.
    const getBracketForRank = (rank, week) => {
        const numRank = parseInt(rank, 10);
        const weekNum = parseInt(week, 10);
    
        // Logique spécifique pour la première semaine. -- A REVOIR POUR FAIRE PLUS PROPRE --
        if (weekNum === 1) {
            if ([1, 10, 15, 20].includes(numRank)) return 1;
            if ([2, 9, 14, 19].includes(numRank)) return 2;
            if ([3, 8, 13, 18].includes(numRank)) return 3;
            if ([4, 7, 12, 17].includes(numRank)) return 4;
            if ([5, 6, 11, 16].includes(numRank)) return 5;
        } else {
            if (numRank > 15) return null;
            return (numRank - 1) % 5 + 1;
        }
        return null;
    };

    const bracketColors = ['#E3F2FD', '#E8F5E9', '#FFFDE7', '#FBE9E7', '#F3E5F5'];

    // Définition des colonnes pour les deux tables.
    const columnsWithoutHandicap = useMemo(() => [
        { accessorKey: 'rank', header: 'Rang', Cell: ({ row }) => row.index + 1, size: 60 },
        { accessorKey: 'name', header: 'Nom', size: 180 },
        { accessorKey: 'score', header: 'Triple', size: 100 },
    ], []);

    const columnsWithHandicap = useMemo(() => [
        { accessorKey: 'rank', header: 'Rang', Cell: ({ row }) => row.index + 1, size: 60 },
        { accessorKey: 'name', header: 'Nom', size: 180 },
        { accessorKey: 'score', header: 'Triple avec Handicap', size: 100 },
    ], []);

    // Fonction pour appliquer un style dynamique aux lignes du tableau.
    const tableRowProps = (row) => {
        const rank = row.index + 1;
        const bracket = getBracketForRank(rank, selectedWeek);
        if (bracket) {
            return { sx: { backgroundColor: bracketColors[bracket - 1] } }; // Applique une couleur selon le bracket.
        }
        return { sx: { backgroundColor: row.index % 2 === 0 ? 'var(--mrt-row-bg-color-even)' : 'var(--mrt-row-bg-color-odd)' } };
    };
// Affichage de la page.
    return (
        <div className={`${styles.container} ${styles.tableRoot}`}>
            <div className={styles.header}>
                <h1 className={styles.title}>Qualification Match Play</h1>
                {weeks.length > 0 && (
                     <div className={styles.weekSelectorContainer}>
                        <label htmlFor="week-selector">Semaine: </label>
                        <select id="week-selector" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} className={styles.weekSelector}>
                            {weeks.map(weekInfo => (
                                <option key={weekInfo.number} value={weekInfo.number}>
                                    Semaine {weekInfo.number} ({weekInfo.date})
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {loading ? (
                <p>Chargement des qualifications...</p>
            ) : (
                <>
                    {/* Affichage des deux tables de qualification. */}
                    <div className={styles.tablesWrapper}>
                        <div className={styles.tableContainer}>
                            <h2>Qualifiés SANS Handicap</h2>
                            <MaterialReactTable
                                columns={columnsWithoutHandicap}
                                data={qualificationData.withoutHandicap}
                                state={{ isLoading: loading }}
                                initialState={{ density: 'compact', pagination: { pageSize: 20, pageIndex: 0 } }}
                                enableStickyHeader
                                muiTableContainerProps={{ className: styles.mrtTableContainer }}
                                muiTableHeadCellProps={{ sx: { backgroundColor: 'var(--mrt-header-bg-color)', color: 'var(--mrt-header-text-color)', padding: 'var(--mrt-header-padding)' } }}
                                muiTableBodyRowProps={({ row }) => tableRowProps(row)} // Application du style de ligne dynamique.
                                muiTableBodyCellProps={{ sx: { padding: 'var(--mrt-cell-padding)' } }}
                            />
                        </div>
                        <div className={styles.tableContainer}>
                            <h2>Qualifiés AVEC Handicap</h2>
                            <MaterialReactTable
                                columns={columnsWithHandicap}
                                data={qualificationData.withHandicap}
                                state={{ isLoading: loading }}
                                initialState={{ density: 'compact', pagination: { pageSize: 20, pageIndex: 0 } }}
                                enableStickyHeader
                                muiTableContainerProps={{ className: styles.mrtTableContainer }}
                                muiTableHeadCellProps={{ sx: { backgroundColor: 'var(--mrt-header-bg-color)', color: 'var(--mrt-header-text-color)', padding: 'var(--mrt-header-padding)' } }}
                                muiTableBodyRowProps={({ row }) => tableRowProps(row)}
                                muiTableBodyCellProps={{ sx: { padding: 'var(--mrt-cell-padding)' } }}
                            />
                        </div>
                    </div>
                    {/* Section dédiée à l'affichage des champions de la semaine précédente. */}
                    <div className={styles.championsContainer}>
                        <h2>Champions de la semaine précédente</h2>
                        {championsLoading ? (
                            <p>Chargement des champions...</p>
                        ) : qualificationData.champions && qualificationData.champions.length > 0 ? (
                            <div className={styles.championsList}>
                                {Object.entries(
                                    qualificationData.champions.reduce((acc, champ) => {
                                        const category = champ.category;
                                        if (!acc[category]) acc[category] = [];
                                        acc[category].push(champ);
                                        return acc;
                                    }, {})
                                ).sort(([catA], [catB]) => catA.localeCompare(catB))
                                .map(([category, champions]) => (
                                    <div key={category} className={styles.championCategory}>
                                        <h4>{category}</h4>
                                        <ul>
                                            {champions.map((champion, index) => (
                                                <li key={index}>{champion.name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        ) : <p>Aucun champion n'a été enregistré pour la semaine précédente ou les données ne sont pas disponibles.</p>}
                    </div>
                </>
            )}
        </div>
    );
};

export default MatchPlayQualification;