import Controller from '../../controller';
import { IUnleashConfig } from '../../../types/option';
import { IUnleashServices } from '../../../types/services';
import ProjectFeaturesController from './features';
import EnvironmentsController from './environments';
import ProjectHealthReport from './health-report';

export default class ProjectApi extends Controller {
    constructor(config: IUnleashConfig, services: IUnleashServices) {
        super(config);
        this.use('/', new ProjectFeaturesController(config, services).router);
        this.use('/', new EnvironmentsController(config, services).router);
        this.use('/', new ProjectHealthReport(config, services).router);
    }
}
