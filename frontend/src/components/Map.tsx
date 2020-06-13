import * as React from 'react';
import { useEffect, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import styles from './Map.scss?module';
import Heatmap, { NumericalPropType } from './Heatmap';
import { useDataFiles } from '../hooks/useDataFiles';
import { DateTime } from 'luxon';
import cx from 'classnames';

export default function Map() {
    const files = useDataFiles();
    const [index, setIndex] = useState<number | null>(null);
    const [showStations, setShowStations] = useState(true);
    const [numericalProp, setNumProp] = useState<NumericalPropType>('bikes_available');
    const maxIndex = files ? files.length - 1 : 0;

    useEffect(() => {
        setIndex(maxIndex);
    }, [files]);

    if (files === null || index === null) {
        return <>Loading files</>;
    }

    const currentFile = files[index];

    function filterButton(prop: NumericalPropType, name: string) {
        const active = numericalProp === prop;

        return (
            <button className={cx(styles.filter, { [styles.active]: active })} onClick={() => setNumProp(prop)}>
                {name}
            </button>
        );
    }

    return (
        <div className={styles.view}>
            <div className={styles.topControls}>
                <button className={styles.button} disabled={index === 0} onClick={() => setIndex(index - 1)}>
                    Previous
                </button>
                <div className={styles.currentDate}>
                    <span>
                        {currentFile.live && <span style={{ color: 'red' }}>&bull;</span>}({index}){' '}
                        {currentFile.date.toLocaleString(DateTime.DATETIME_MED)}
                    </span>
                </div>
                <button className={styles.button} disabled={index === maxIndex} onClick={() => setIndex(index + 1)}>
                    Next
                </button>
            </div>

            <Heatmap file={currentFile} showStations={showStations} numericalProp={numericalProp} />

            <div className={styles.filters}>
                {filterButton('bikes_available', 'All bikes')}
                {filterButton('bikes_available_mechanical', 'Mechanical')}
                {filterButton('bikes_available_ebike', 'Ebike')}
                {filterButton('docks_available', 'Docks')}
                <button className={styles.button} onClick={() => setShowStations(!showStations)}>
                    {showStations ? 'Show Heatmap' : 'Show stations'}
                </button>
            </div>
        </div>
    );
}
