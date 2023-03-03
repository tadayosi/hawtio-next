import { jolokiaService } from '@hawtiosrc/plugins/connect'
import { isBlank } from '@hawtiosrc/util/strings'
import { log } from './globals'

const ACL_MBEAN_PATTERN = '*:type=security,area=jmx,*'

interface IRBACService {
  getACLMBean(): Promise<string>
}

class RBACService implements IRBACService {
  private aclMBean: Promise<string>

  constructor() {
    this.aclMBean = this.fetchACLMBean()
  }

  private async fetchACLMBean(): Promise<string> {
    const mbeans = await jolokiaService.search(ACL_MBEAN_PATTERN)
    log.debug('Fetching ACL MBeans:', mbeans)

    if (mbeans.length === 0) {
      log.info("Didn't discover any ACL MBeans; client-side RBAC is disabled")
      return ''
    }

    if (mbeans.length === 1) {
      log.info('Use MBean', mbeans[0], 'for client-side RBAC')
      return mbeans[0]
    }

    // mbeans > 1
    const chosen = mbeans.find(mbean => !mbean.includes('HawtioDummy'))
    if (!chosen || isBlank(chosen)) {
      log.info("Didn't discover any effective ACL MBeans; client-side RBAC is disabled")
      return ''
    }
    log.info('Use MBean', chosen, 'for client-side RBAC')
    return chosen
  }

  getACLMBean(): Promise<string> {
    return this.aclMBean
  }
}

export const rbacService = new RBACService()

// Export non-exported definitions for testing
export const __testing__ = {
  RBACService,
}
