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

    useEffect(() => {
        const fetchScheduleForWeeks = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule`);
                const data = await response.json();
                // Extraire les numéros de semaine uniques et leurs dates correspondantes
                const uniqueWeekData = Array.from(new Map(data.map(item => [item.weekid, { number: item.weekid, date: new Date(item.weekdate).toLocaleDateString('fr-CA') }])).values())
                                            .sort((a, b) => a.number - b.number);
                setWeeks(uniqueWeekData);
                if (uniqueWeekData.length > 0) {
                    setSelectedWeek(String(uniqueWeekData[uniqueWeekData.length - 1].number));
                }
            } catch (error) {
                console.error("Error fetching schedule for weeks:", error);
            }
        };
        fetchScheduleForWeeks();
    }, []);

    useEffect(() => {
        if (!selectedWeek) return;

        const fetchQualificationData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/matchplay/qualification/${selectedWeek}`);
                const data = await response.json();
                setQualificationData(data);
            } catch (error) {
                console.error('Error fetching qualification data:', error);
            }
            setLoading(false);
        };

        fetchQualificationData();
    }, [selectedWeek]);

    const columnsWithoutHandicap = useMemo(
        () => [
            {
                accessorKey: 'rank',
                header: 'Rang',
                Cell: ({ row }) => row.index + 1,
                size: 60,
            },
            { accessorKey: 'name', header: 'Nom', size: 180 },
            { accessorKey: 'score', header: 'Triple', size: 100 },
        ],
        [],
    );

    const columnsWithHandicap = useMemo(
        () => [
            {
                accessorKey: 'rank',
                header: 'Rang',
                Cell: ({ row }) => row.index + 1,
                size: 60,
            },
            { accessorKey: 'name', header: 'Nom', size: 180 },
            { accessorKey: 'score', header: 'Triple avec Handicap', size: 100 },
        ],
        [],
    );

    return (
        <div className={styles.container}>
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
                <p>Chargement...</p>
            ) : (
                <>
                    <div className={styles.tablesWrapper}>
                        <div className={styles.tableContainer}>
                            <h2>Qualifiés SANS Handicap</h2>
                            <MaterialReactTable
                                columns={columnsWithoutHandicap}
                                data={qualificationData.withoutHandicap}
                                state={{ isLoading: loading }}
                                initialState={{
                                    density: 'compact',
                                    pagination: { pageSize: 20, pageIndex: 0 },
                                }}
                                enableStickyHeader
                                muiTableContainerProps={{ className: styles.mrtTableContainer }}
                                muiTableHeadCellProps={{
                                    sx: {
                                        backgroundColor: 'var(--mrt-header-bg-color)',
                                        color: 'var(--mrt-header-text-color)',
                                        padding: 'var(--mrt-header-padding)',
                                    },
                                }}
                                muiTableBodyRowProps={({ row, table }) => {
                                    const { rows } = table.getRowModel();
                                    const rowIndex = rows.findIndex(r => r.id === row.id);
                                    return {
                                        sx: {
                                            backgroundColor: rowIndex % 2 === 0
                                                ? 'var(--mrt-row-bg-color-even)'
                                                : 'var(--mrt-row-bg-color-odd)',
                                        },
                                    };
                                }}
                                muiTableBodyCellProps={{
                                    sx: {
                                        padding: 'var(--mrt-cell-padding)',
                                    },
                                }}
                            />
                        </div>
                        <div className={styles.tableContainer}>
                            <h2>Qualifiés AVEC Handicap</h2>
                            <MaterialReactTable
                                columns={columnsWithHandicap}
                                data={qualificationData.withHandicap}
                                state={{ isLoading: loading }}
                                initialState={{
                                    density: 'compact',
                                    pagination: { pageSize: 20, pageIndex: 0 },
                                }}
                                enableStickyHeader
                                muiTableContainerProps={{ className: styles.mrtTableContainer }}
                                muiTableHeadCellProps={{
                                    sx: {
                                        backgroundColor: 'var(--mrt-header-bg-color)',
                                        color: 'var(--mrt-header-text-color)',
                                        padding: 'var(--mrt-header-padding)',
                                    },
                                }}
                                muiTableBodyRowProps={({ row, table }) => {
                                    const { rows } = table.getRowModel();
                                    const rowIndex = rows.findIndex(r => r.id === row.id);
                                    return {
                                        sx: {
                                            backgroundColor: rowIndex % 2 === 0
                                                ? 'var(--mrt-row-bg-color-even)'
                                                : 'var(--mrt-row-bg-color-odd)',
                                        },
                                    };
                                }}
                                muiTableBodyCellProps={{
                                    sx: {
                                        padding: 'var(--mrt-cell-padding)',
                                    },
                                }}
                            />
                        </div>
                    </div>
                    <div className={styles.championsContainer}>
                         <h2>Champions de la semaine précédente</h2>
                         {qualificationData.champions && qualificationData.champions.length > 0 ? (
                            <ul>
                                {qualificationData.champions.map((champion, index) => (
                                    <li key={index}>{champion}</li>
                                ))}
                            </ul>
                        ) : <p>Aucun champion pour la semaine précédente.</p>}
                    </div>
                </>
            )}
        </div>
    );
};

export default MatchPlayQualification;