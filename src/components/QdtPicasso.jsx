import React from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import picasso from 'picasso.js';
import picassoQ from 'picasso-plugin-q';
import withHyperCube from './withHyperCube';
import properties from '../properties/';
import Tooltip from '../utilities/Tooltip';
import utility from '../utilities/';
import '../styles/index.scss';

class QdtPicassoComponent extends React.Component {
    static propTypes = {
    //   qObject: PropTypes.object.isRequired,
      type: PropTypes.string.isRequired,
    }

    constructor(props) {
      super(props);

      this.tooltip = new Tooltip();
      this.pic = null;
      this.selections = [];
      this.uid = utility.uid(8);
      this.qObject = null;
      this.settings = null;
      this.state = {
        selectionsOn: false,
        outerHeight: '400px',
        innerHeight: '400px',
        outerWidth: '100%',
        innerWidth: '100%',
      };
    }

    componentWillMount() {
      picasso.use(picassoQ);
      this.tooltip.create();
    }
    componentDidMount() {
    //   const { qObject } = this.props;
      this.create();
    }
    componentDidUpdate() {
    }

    @autobind
    async create() {
      const { tooltip, uid, divElement } = this;
      const {
        qDocPromise, cols, type, qHyperCubeDef, height, options,
      } = this.props;
      const qDoc = await qDocPromise;
      const qProp = { qInfo: { qType: 'visualization' } };
      if (cols[1]) qHyperCubeDef.qMeasures[0].qDef = { qDef: cols[1] };
      if (cols[0]) qHyperCubeDef.qDimensions[0].qDef.qFieldDefs = [cols[0]];
      if (cols[2]) qHyperCubeDef.qMeasures[1].qDef = { qDef: cols[2] };
      qProp.qHyperCubeDef = qHyperCubeDef;
      this.qObject = await qDoc.createSessionObject(qProp);
      this.qObject.on('changed', () => { this.update(); });
      const qLayout = await this.qObject.getLayout();
      // Set scrolling for Horizontal Bar
      if (type === 'horizontalBar' && height) {
        const proposedHeight = qLayout.qHyperCube.qDataPages[0].qMatrix.length * (30 + 5);
        const innerHeight = (proposedHeight > height) ? proposedHeight : height;
        this.setState({ outerHeight: height, innerHeight });
      } else if (type === 'verticalBar' && divElement.clientWidth) {
        const myBarWidth = (options.barWidth) ? options.barWidth : 100;
        const proposedWidth = qLayout.qHyperCube.qDataPages[0].qMatrix.length * (myBarWidth + 5);
        const innerWidth = (proposedWidth > divElement.clientWidth) ? proposedWidth : divElement.clientWidth;
        this.setState({ outerWidth: divElement.clientWidth, innerWidth });
      }
      //   const { qLayout } = await this.props;
      // Set the Picasso properties json
      const settings = properties[type];
      if (type === 'scotterplot') {
        if (options.href) {
          settings.components[3].settings = {
            x: { scale: 'm' },
            y: { scale: 's' },
            shape: 'image',
            href: options.href,
            width: (options.imageWidth) ? options.imageWidth : 10,
            height: (options.imageHeight) ? options.imageHeight : 10,
          };
          settings.components[4].settings.sources[0].component = 'image';
          settings.components[4].settings.sources[0].selector = 'circle';
        }

        // Remove the legend from the components array
        // if (options.noLegend) settings.components.splice(1, 1);
      }
      settings.interactions[0].events = {
        mousemove(e) {
          tooltip.div.x = e.pageX;
          tooltip.div.y = e.pageY;
          if (e.target.className !== 'qdt-chart-svg') {
            tooltip.show();
          }
        },
        mouseout() {
          tooltip.hide();
        },
      };
      if (!this.pic) {
        this.pic = picasso.chart({
          element: document.querySelector(`#${uid} .qdt-chart-svg`),
          data: [{
            type: 'q',
            key: 'qHyperCube',
            data: qLayout.qHyperCube,
          }],
          settings,
        });
        this.pic.brush('tooltip').on('update', (data) => {
          if (data.length) {
            this.tooltip.show(data);
          } else {
            this.tooltip.hide();
          }
        });
        // No data is return if clicked on an inactive rect. How do we deselect?
        this.pic.brush('select').on('update', (data) => {
          const { select, selectionsOn, beginSelections } = this;
          if (!selectionsOn) beginSelections();
          if (data && data[0] && data[0].values && data[0].values[0] && data[0].values[0].qElemNumber) select(Number(data[0].values[0].qElemNumber));
        });
        this.settings = settings;
      } else {
        this.update();
      }
    }

    @autobind
    async update() {
      const { settings, pic } = this;
      const qLayout = await this.qObject.getLayout();
      pic.update({
        data: [{
          type: 'q',
          key: 'qHyperCube',
          data: qLayout.qHyperCube,
        }],
        settings,
      });
    }

    @autobind
    beginSelections() {
      this.setState({ selectionsOn: true });
    }

    @autobind
    endSelections() {
      const { pic } = this;
      pic.brush('highlight').end();
      pic.brush('select').end();
      this.setState({ selectionsOn: false });
    }

    @autobind
    async select(qElemNumber) {
      if (this.selections.includes(qElemNumber)) {
        this.selections = this.selections.filter(x => x !== qElemNumber);
      } else if (qElemNumber >= 0) {
        this.selections = [...this.selections, qElemNumber];
      }
    }

    @autobind
    async confirmSelections() {
      const { selections, endSelections, create } = this;
      const { select } = this.props;
      await select(selections);
      endSelections();
      create();
    }

    @autobind
    async cancelSelections() {
      this.endSelections();
    }

    render() {
      const { type } = this.props;
      const {
        selectionsOn, outerHeight, innerHeight, outerWidth, innerWidth,
      } = this.state;
      const { cancelSelections, confirmSelections, uid } = this;
      let style = {};
      switch (type) {
        case 'horizontalBar':
          style = {
            width: outerWidth, height: outerHeight, 'overflow-y': (innerHeight === '100%') ? 'hidden' : 'auto', 'overflow-x': 'hidden',
          };
          break;
        case 'verticalBar':
          style = {
            width: outerWidth, height: outerHeight, 'overflow-y': 'hidden', 'overflow-x': (innerWidth === '100%') ? 'hidden' : 'auto',
          };
          break;
        default:
          style = {
            width: outerWidth, height: outerHeight, 'overflow-y': 'hidden', 'overflow-x': 'hidden',
          };
      }
      return (
        <div
          id={uid}
          className="qtd-chart"
          style={style}
          ref={element => this.divElement = element}
        >
          <div className="qdt-chart-header">
            {selectionsOn &&
              <div className="qdt-chart-selection">
                <button className="lui-button lui-button--danger" tabIndex={0} key="cancelSelections" onClick={() => cancelSelections()}><span className="lui-icon lui-icon--close" /></button>
                <button className="lui-button lui-button--success" tabIndex={0} key="confirmSelections" onClick={() => confirmSelections()}><span className="lui-icon lui-icon--tick" /></button>
              </div>
            }
            <div className="qdt-chart-svg" style={{ width: innerWidth, height: innerHeight }} />
          </div>
        </div>
      );
    }
}
QdtPicassoComponent.propTypes = {
//   qLayout: PropTypes.object.isRequired,
  //   qData: PropTypes.object.isRequired,
//   qObject: PropTypes.object.isRequired,
  select: PropTypes.object.isRequired,
};

const QdtPicasso = withHyperCube(QdtPicassoComponent);
QdtPicasso.propTypes = {
  qDocPromise: PropTypes.object.isRequired,
  qLayout: PropTypes.object.isRequired,
  type: PropTypes.oneOf(['horizontalBar', 'verticalBar', 'pie', 'scotterplot']).isRequired,
  cols: PropTypes.array,
  qHyperCubeDef: PropTypes.object,
  options: PropTypes.object,
  width: PropTypes.string,
  height: PropTypes.string,
};
properties.hyperCube.qHyperCubeDef.qInterColumnSortOrder = [1, 0];
properties.hyperCube.qHyperCubeDef.qInitialDataFetch.qWidth = 2;
properties.hyperCube.qHyperCubeDef.qInitialDataFetch.qHeight = 50;
QdtPicasso.defaultProps = {
  cols: null,
  qHyperCubeDef: properties.hyperCube.qHyperCubeDef,
  qPage: {
    qTop: 0,
    qLeft: 0,
    qWidth: 3,
    qHeight: 50,
  },
  width: '100%',
  height: '100%',
};

export default QdtPicasso;
