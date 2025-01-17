import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core'
import { ConfigurationsService, NsPage } from '@sunbird-cb/utils'
import { Subscription } from 'rxjs'
import { ActivatedRoute } from '@angular/router'
import { PublicHomeService } from 'src/app/services/public-home.service'
import { DomSanitizer, SafeUrl } from '@angular/platform-browser'

@Component({
  selector: 'ws-public-home',
  templateUrl: './public-home.component.html',
  styleUrls: ['./public-home.component.scss'],
  // tslint:disable-next-line
  encapsulation: ViewEncapsulation.None,
})
export class PublicHomeComponent implements OnInit, OnDestroy {
  contactUsMail = ''
  contactPage: any
  platform = 'Learner'
  panelOpenState = false
  appIcon: SafeUrl | null = null
  appIconSecondary: SafeUrl | null = null
  pageNavbar: Partial<NsPage.INavBackground> = this.configSvc.pageNavBar
  private subscriptionContact: Subscription | null = null
  learnNetworkSection: any = []

  constructor(
    private phomesrvc: PublicHomeService,
    private configSvc: ConfigurationsService,
    private activateRoute: ActivatedRoute,
    private domSanitizer: DomSanitizer,
    // private authSvc: AuthKeycloakService,
  ) { }

  ngOnInit() {
    if (this.configSvc.instanceConfig) {
      this.appIcon = this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.configSvc.instanceConfig.logos.app,
      )
      this.appIconSecondary = this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.configSvc.instanceConfig.logos.appSecondary,
      )
    }
    this.subscriptionContact = this.activateRoute.data.subscribe(data => {
      this.contactPage = data.pageData && data.pageData.data
    })
    if (this.configSvc.instanceConfig) {
      this.contactUsMail = this.configSvc.instanceConfig.mailIds.contactUs
    }

    const url = `${this.configSvc.sitePath}/feature/public-home.json`
    this.phomesrvc.fetchConfig(url).subscribe(
      (config: any) => {
        this.learnNetworkSection = config.learnNetwork
      },
      _err => { })
    // this.authSvc.force_logout().then(() => { })
  }

  ngOnDestroy() {
    if (this.subscriptionContact) {
      this.subscriptionContact.unsubscribe()
    }
  }
  login() {
    const host = window.location.origin
    window.location.href = `${host}/protected/v8/resource`
    // window.location.reload()
  }
}
