import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core'
import { FormGroup, FormControl, Validators, FormArray, FormBuilder, AbstractControl, ValidatorFn } from '@angular/forms'
import { ENTER, COMMA } from '@angular/cdk/keycodes'
import { Subscription, Observable } from 'rxjs'
import { startWith, map, debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { MatSnackBar, MatChipInputEvent, DateAdapter, MAT_DATE_FORMATS, MatDialog, MatTabChangeEvent } from '@angular/material'
import { AppDateAdapter, APP_DATE_FORMATS, changeformat } from '../../services/format-datepicker'
import { ImageCropComponent, ConfigurationsService, WsEvents, EventService } from '@sunbird-cb/utils'
import { IMAGE_MAX_SIZE, IMAGE_SUPPORT_TYPES } from '@ws/author/src/lib/constants/upload'
import { UserProfileService } from '../../services/user-profile.service'
import { Router, ActivatedRoute } from '@angular/router'
import {
  INationality,
  ILanguages,
  IChipItems,
  IGovtOrgMeta,
  IIndustriesMeta,
  IProfileAcademics,
  INation,
  IdegreesMeta,
} from '../../models/user-profile.model'
import { NsUserProfileDetails } from '@ws/app/src/lib/routes/user-profile/models/NsUserProfile'
import { NotificationComponent } from '@ws/author/src/lib/modules/shared/components/notification/notification.component'
import { Notify } from '@ws/author/src/lib/constants/notificationMessage'
import { NOTIFICATION_TIME } from '@ws/author/src/lib/constants/constant'
import { LoaderService } from '@ws/author/src/public-api'
/* tslint:disable */
import _ from 'lodash'
/* tslint:enable */

export function forbiddenNamesValidator(optionsArray: any): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } | null => {
    if (!optionsArray) {
      return null
      // tslint:disable-next-line: no-else-after-return
    } else {
      const index = optionsArray.findIndex((op: any) => {
        // tslint:disable-next-line: prefer-template
        return new RegExp('^' + op.name + '$').test(control.value)
      })
      return index < 0 ? { forbiddenNames: { value: control.value } } : null
    }
  }
}
@Component({
  selector: 'ws-app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss'],
  providers: [
    { provide: DateAdapter, useClass: AppDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: APP_DATE_FORMATS },
  ],
})
export class UserProfileComponent implements OnInit, OnDestroy {
  createUserForm: FormGroup
  unseenCtrl!: FormControl
  unseenCtrlSub!: Subscription
  uploadSaveData = false
  selectedIndex = 0
  masterNationality: Observable<INation[]> | undefined
  countries: INation[] = []
  masterLanguages: Observable<ILanguages[]> | undefined
  masterKnownLanguages: Observable<ILanguages[]> | undefined
  masterNationalities: INation[] = []
  masterLanguagesEntries!: ILanguages[]
  selectedKnowLangs: ILanguages[] = []
  separatorKeysCodes: number[] = [ENTER, COMMA]
  public personalInterests: IChipItems[] = []
  public selectedHobbies: IChipItems[] = []
  ePrimaryEmailType = NsUserProfileDetails.EPrimaryEmailType
  eUserGender = NsUserProfileDetails.EUserGender
  eMaritalStatus = NsUserProfileDetails.EMaritalStatus
  eCategory = NsUserProfileDetails.ECategory
  userProfileFields!: NsUserProfileDetails.IUserProfileFields
  inReview = 'In Review!'
  imageTypes = IMAGE_SUPPORT_TYPES
  today = new Date()
  phoneNumberPattern = '^((\\+91-?)|0)?[0-9]{10}$'
  pincodePattern = '(^[0-9]{6}$)'
  yearPattern = '(^[0-9]{4}$)'
  namePatern = `^[a-zA-Z\\s\\']{1,32}$`
  telephonePattern = `^[0-9]+-?[0-9]+$`
  @ViewChild('toastSuccess', { static: true }) toastSuccess!: ElementRef<any>
  @ViewChild('toastError', { static: true }) toastError!: ElementRef<any>
  @ViewChild('knownLanguagesInput', { static: true }) knownLanguagesInputRef!: ElementRef<HTMLInputElement>
  isEditEnabled = false
  tncAccepted = false
  isOfficialEmail = false
  govtOrgMeta!: IGovtOrgMeta
  industriesMeta!: IIndustriesMeta
  degreesMeta!: IdegreesMeta
  designationsMeta!: any // IdesignationsMeta
  public degrees!: FormArray
  public postDegrees!: FormArray
  public degreeInstitutes = []
  public postDegreeInstitutes = []
  public countryCodes: string[] = []
  showDesignationOther!: boolean
  showOrgnameOther!: boolean
  showIndustryOther!: boolean
  photoUrl!: string | ArrayBuffer | null
  isForcedUpdate = false
  userProfileData!: any
  allDept: any = []
  approvalConfig!: NsUserProfileDetails.IApprovals
  unApprovedField!: any[]
  changedProperties: any = {}
  constructor(
    private snackBar: MatSnackBar,
    private userProfileSvc: UserProfileService,
    private configSvc: ConfigurationsService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private cd: ChangeDetectorRef,
    public dialog: MatDialog,
    private loader: LoaderService,
    private eventSvc: EventService,
  ) {
    this.approvalConfig = this.route.snapshot.data.pageData.data
    this.isForcedUpdate = !!this.route.snapshot.paramMap.get('isForcedUpdate')
    this.fetchPendingFields()
    // console.log('page data', this.approvalConfig)
    this.createUserForm = new FormGroup({
      firstname: new FormControl('', [Validators.required, Validators.pattern(this.namePatern)]),
      middlename: new FormControl('', [Validators.pattern(this.namePatern)]),
      surname: new FormControl('', [Validators.required, Validators.pattern(this.namePatern)]),
      photo: new FormControl('', []),
      countryCode: new FormControl('', [Validators.required]),
      mobile: new FormControl('', [Validators.required, Validators.pattern(this.phoneNumberPattern)]),
      telephone: new FormControl('', [Validators.pattern(this.telephonePattern)]),
      primaryEmail: new FormControl('', [Validators.required, Validators.email]),
      primaryEmailType: new FormControl(this.assignPrimaryEmailTypeCheckBox(this.ePrimaryEmailType.OFFICIAL), []),
      secondaryEmail: new FormControl('', []),
      nationality: new FormControl('', [Validators.required, forbiddenNamesValidator(this.masterNationality)]),
      dob: new FormControl('', [Validators.required]),
      gender: new FormControl('', [Validators.required]),
      maritalStatus: new FormControl('', [Validators.required]),
      domicileMedium: new FormControl('', [Validators.required]),
      knownLanguages: new FormControl([], []),
      residenceAddress: new FormControl('', [Validators.required]),
      category: new FormControl('', [Validators.required]),
      pincode: new FormControl('', [Validators.required, Validators.pattern(this.pincodePattern)]),
      schoolName10: new FormControl('', []),
      yop10: new FormControl('', [Validators.pattern(this.yearPattern)]),
      schoolName12: new FormControl('', []),
      yop12: new FormControl('', [Validators.pattern(this.yearPattern)]),
      degrees: this.fb.array([this.createDegree()]),
      postDegrees: this.fb.array([this.createDegree()]),
      certificationDesc: new FormControl('', []),
      interests: new FormControl('', []),
      hobbies: new FormControl('', []),
      skillAquiredDesc: new FormControl('', []),
      isGovtOrg: new FormControl(false, []),
      orgName: new FormControl('', []),
      orgNameOther: new FormControl('', []),
      industry: new FormControl('', []),
      industryOther: new FormControl('', []),
      designation: new FormControl('', []),
      designationOther: new FormControl('', []),
      location: new FormControl('', []),
      locationOther: new FormControl('', []),
      doj: new FormControl('', []),
      orgDesc: new FormControl('', []),
      payType: new FormControl('', []),
      service: new FormControl('', []),
      cadre: new FormControl('', []),
      allotmentYear: new FormControl('', [Validators.pattern(this.yearPattern)]),
      otherDetailsDoj: new FormControl('', []),
      civilListNo: new FormControl('', []),
      employeeCode: new FormControl('', []),
      otherDetailsOfficeAddress: new FormControl('', []),
      otherDetailsOfficePinCode: new FormControl('', []),
      departmentName: new FormControl('', []),
    })
    this.init()
  }
  async init() {
    await this.loadDesignations()
    this.fetchMeta()
  }
  ngOnInit() {
    // this.unseenCtrlSub = this.createUserForm.valueChanges.subscribe(value => {
    //   console.log('ngOnInit - value', value);
    // })
    const approvalData = _.compact(_.map(this.approvalConfig, (v, k) => {
      return v.approvalRequired ? { [k]: v } : null
    }))

    if (approvalData.length > 0) {
      // need to call search API
    }
    this.getUserDetails()

    // this.assignPrimaryEmailType(this.isOfficialEmail)
  }
  fetchMeta() {
    this.userProfileSvc.getMasterNationlity().subscribe(
      data => {
        data.nationalities.map((item: INationality) => {
          this.masterNationalities.push({ name: item.name })
          this.countries.push({ name: item.name })
          this.countryCodes.push(item.countryCode)
        })
        this.createUserForm.patchValue({
          countryCode: this.countryCodes[0],
        })
        this.onChangesNationality()
      },
      (_err: any) => {
      })

    this.userProfileSvc.getMasterLanguages().subscribe(
      data => {
        this.masterLanguagesEntries = data.languages
        this.onChangesLanuage()
        this.onChangesKnownLanuage()
      },
      (_err: any) => {
      })
    this.userProfileSvc.getProfilePageMeta().subscribe(
      data => {
        this.govtOrgMeta = data.govtOrg
        this.industriesMeta = data.industries
        this.degreesMeta = data.degrees
        // this.designationsMeta = data.designations
      },
      (_err: any) => {
      })
    this.userProfileSvc.getAllDepartments().subscribe(
      (data: any) => {
        this.allDept = data
      },
      (_err: any) => {
      })

    // const desreq = {
    //   searches: [
    //     {
    //       type: 'POSITION',
    //       field: 'name',
    //       keyword: '',
    //     },
    //     {
    //       field: 'status',
    //       keyword: 'VERIFIED',
    //       type: 'POSITION',
    //     },
    //   ],
    // }
  }
  async loadDesignations() {
    await this.userProfileSvc.getDesignations({}).subscribe(
      (data: any) => {
        this.designationsMeta = data.responseData
      },
      (_err: any) => {
      })
  }
  createDegree(): FormGroup {
    return this.fb.group({
      degree: new FormControl('', []),
      instituteName: new FormControl('', []),
      yop: new FormControl('', [Validators.pattern(this.yearPattern)]),
    })
  }

  fetchPendingFields() {
    this.userProfileSvc.listApprovalPendingFields().subscribe(res => {
      if (res && res.result && res.result.data) {
        this.unApprovedField = _.get(res, 'result.data')
        // console.log('unApprovedField ', this.unApprovedField, res)
      }
    })
  }
  isAllowed(name: string) {
    if (name && !!this.unApprovedField && this.unApprovedField.length > 0) {
      return !!!(this.unApprovedField.indexOf(name) >= 0)
    } return true
  }
  createDegreeWithValues(degree: any): FormGroup {
    return this.fb.group({
      degree: new FormControl(degree.degree, []),
      instituteName: new FormControl(degree.instituteName, []),
      yop: new FormControl(degree.yop, [Validators.pattern(this.yearPattern)]),
    })
  }

  public addDegree() {
    this.degrees = this.createUserForm.get('degrees') as FormArray
    this.degrees.push(this.createDegree())
  }

  public addDegreeValues(degree: any) {
    this.degrees = this.createUserForm.get('degrees') as FormArray
    this.degrees.push(this.createDegreeWithValues(degree))
  }

  get degreesControls() {
    const deg = this.createUserForm.get('degrees')
    return (<any>deg)['controls']
  }

  public removeDegrees(i: number) {
    this.degrees.removeAt(i)
  }

  public addPostDegree() {
    this.postDegrees = this.createUserForm.get('postDegrees') as FormArray
    this.postDegrees.push(this.createDegree())
  }

  public addPostDegreeValues(degree: any) {
    this.postDegrees = this.createUserForm.get('postDegrees') as FormArray
    this.postDegrees.push(this.createDegreeWithValues(degree))
  }

  get postDegreesControls() {
    const deg = this.createUserForm.get('postDegrees')
    return (<any>deg)['controls']
  }

  public removePostDegrees(i: number) {
    this.postDegrees.removeAt(i)
  }

  onChangesNationality(): void {
    if (this.createUserForm.get('nationality') != null) {

      // tslint:disable-next-line: no-non-null-assertion
      this.masterNationality = this.createUserForm.get('nationality')!.valueChanges
        .pipe(
          debounceTime(500),
          distinctUntilChanged(),
          startWith(''),
          map(value => typeof value === 'string' ? value : (value && value.name ? value.name : '')),
          map(name => name ? this.filterNationality(name) : this.masterNationalities.slice())
        )
      const newLocal = 'nationality'
      this.masterNationality.subscribe(event => {
        // tslint:disable-next-line: no-non-null-assertion
        this.createUserForm.get(newLocal)!.setValidators([Validators.required, forbiddenNamesValidator(event)])
        this.createUserForm.updateValueAndValidity()
      })
    }
  }

  onChangesLanuage(): void {

    // tslint:disable-next-line: no-non-null-assertion
    this.masterLanguages = this.createUserForm.get('domicileMedium')!.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        startWith(''),
        map(value => typeof (value) === 'string' ? value : (value && value.name ? value.name : '')),
        map(name => name ? this.filterLanguage(name) : this.masterLanguagesEntries.slice())
      )
  }

  onChangesKnownLanuage(): void {
    // tslint:disable-next-line: no-non-null-assertion
    this.masterKnownLanguages = this.createUserForm.get('knownLanguages')!.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        startWith(''),
        map(value => typeof value === 'string' || 'ILanguages' ? value : value.name),
        map(name => {
          if (name) {
            if (name.constructor === Array) {
              return this.filterMultiLanguage(name)
            }
            return this.filterLanguage(name)
          }
          return this.masterLanguagesEntries.slice()
        })
      )
  }

  private filterNationality(name: string): INation[] {
    if (name) {
      const filterValue = name.toLowerCase()
      return this.masterNationalities.filter(option => option.name.toLowerCase().includes(filterValue))
    }
    return this.masterNationalities
  }

  private filterLanguage(name: string): ILanguages[] {
    if (name) {
      const filterValue = name.toLowerCase()
      return this.masterLanguagesEntries.filter(option => option.name.toLowerCase().includes(filterValue))
    }
    return this.masterLanguagesEntries
  }

  private filterMultiLanguage(name: string[]): ILanguages[] {
    if (name) {
      const filterValue = name.map(n => n.toLowerCase())
      return this.masterLanguagesEntries.filter(option => {
        // option.name.toLowerCase().includes(filterValue))
        filterValue.map(f => {
          return option.name.toLowerCase().includes(f)
        })
      })
    }
    return this.masterLanguagesEntries
  }

  ngOnDestroy() {
    if (this.unseenCtrlSub && !this.unseenCtrlSub.closed) {
      this.unseenCtrlSub.unsubscribe()
    }
  }

  public selectKnowLanguage(data: any, input: any) {
    const value: ILanguages = data.option.value
    if (!this.selectedKnowLangs.includes(value)) {
      this.selectedKnowLangs.push(data.option.value)
    }
    if (this.knownLanguagesInputRef && this.knownLanguagesInputRef.nativeElement) {
      this.knownLanguagesInputRef.nativeElement.value = ''
    }
    if (input && input.value) {
      input.value = ''
    }
    // this.knownLanguagesInputRef.nativeElement.value = ''
    if (this.createUserForm.get('knownLanguages')) {
      // tslint:disable-next-line: no-non-null-assertion
      this.createUserForm.get('knownLanguages')!.setValue(null)
    }
  }

  public removeKnowLanguage(lang: any) {
    const index = this.selectedKnowLangs.indexOf(lang)

    if (index >= 0) {
      this.selectedKnowLangs.splice(index, 1)
    }

  }

  add(event: MatChipInputEvent): void {
    const input = event.input
    const value = event.value as unknown as ILanguages

    // Add our fruit
    if ((value || '')) {
      this.selectedKnowLangs.push(value)
    }

    // Reset the input value
    if (input) {
      input.value = ''
    }
    if (this.knownLanguagesInputRef && this.knownLanguagesInputRef.nativeElement) {
      this.knownLanguagesInputRef.nativeElement.value = ''
    }
    if (this.createUserForm.get('knownLanguages')) {
      // tslint:disable-next-line: no-non-null-assertion
      this.createUserForm.get('knownLanguages')!.setValue(null)
    }
  }

  addPersonalInterests(event: MatChipInputEvent): void {
    const input = event.input
    const value = event.value as unknown as IChipItems

    if ((value || '')) {
      this.personalInterests.push(value)
    }

    if (input) {
      input.value = ''
    }

    // this.knownLanguagesInputRef.nativeElement.value = ''
    if (this.createUserForm.get('interests')) {
      // tslint:disable-next-line: no-non-null-assertion
      this.createUserForm.get('interests')!.setValue(null)
    }
  }

  addHobbies(event: MatChipInputEvent) {
    const input = event.input
    const value = event.value as unknown as IChipItems

    if ((value || '')) {
      this.selectedHobbies.push(value)
    }

    if (input) {
      input.value = ''
    }

    if (this.createUserForm.get('hobbies')) {
      // tslint:disable-next-line: no-non-null-assertion
      this.createUserForm.get('hobbies')!.setValue(null)
    }
  }

  removePersonalInterests(interest: any) {
    const index = this.personalInterests.indexOf(interest)

    if (index >= 0) {
      this.personalInterests.splice(index, 1)
    }
  }

  removeHobbies(interest: any) {
    const index = this.selectedHobbies.indexOf(interest)

    if (index >= 0) {
      this.selectedHobbies.splice(index, 1)
    }
  }

  getUserDetails() {
    // if (this.configSvc.unMappedUser && this.configSvc.unMappedUser.id) {
    //   console.log(this.configSvc.unMappedUser)
    // }
    if (this.configSvc.unMappedUser && this.configSvc.unMappedUser.id) {
      // if (this.configSvc.userProfile) {
      this.userProfileSvc.getUserdetailsFromRegistry(this.configSvc.unMappedUser.id).subscribe(
        (data: any) => {
          const userData = {
            ...data.profileDetails || _.get(this.configSvc.unMappedUser, 'profileDetails'),
            id: data.id, userId: data.userId,
          }
          if (data.profileDetails && (userData.id || userData.userId)) {
            const academics = this.populateAcademics(userData)
            this.setDegreeValuesArray(academics)
            this.setPostDegreeValuesArray(academics)
            const organisations = this.populateOrganisationDetails(userData)
            this.constructFormFromRegistry(userData, academics, organisations)
            this.populateChips(userData)
            this.userProfileData = userData
          } else {
            if (this.configSvc.userProfile) {
              this.userProfileData = { ...userData, id: this.configSvc.userProfile.userId, userId: this.configSvc.userProfile.userId }
              this.createUserForm.patchValue({
                firstname: this.configSvc.userProfile.firstName,
                surname: this.configSvc.userProfile.lastName,
                primaryEmail: _.get(this.userProfileData, 'personalDetails.primaryEmail') || this.configSvc.userProfile.email,
                orgName: this.configSvc.userProfile.rootOrgName,
              })
            }
          }
          // this.handleFormData(data[0])
        },
        (_err: any) => {
        })
    } else {
      // if (this.configSvc.userProfile) {
      //   this.userProfileSvc.getUserdetails(this.configSvc.userProfile.email).subscribe(
      //     data => {
      //       if (data && data.length) {
      //         this.createUserForm.patchValue({
      //           firstname: data[0].first_name,
      //           surname: data[0].last_name,
      //           primaryEmail: data[0].email,
      //           orgName: data[0].department_name,
      //         })
      //       }
      //     },
      //     () => {
      //       // console.log('err :', err)
      //     })
      // }
      if (this.configSvc.userProfile) {
        const tempData = this.configSvc.userProfile
        this.userProfileData = _.get(this.configSvc, 'unMappedUser.profileDetails')
        this.createUserForm.patchValue({
          firstname: tempData.firstName,
          surname: tempData.lastName,
          primaryEmail: _.get(this.configSvc.unMappedUser, 'profileDetails.personalDetails.primaryEmail') || tempData.email,
          orgName: tempData.rootOrgName,
        })
      }
    }
  }

  private populateOrganisationDetails(data: any) {
    let org = {
      isGovtOrg: true,
      orgName: '',
      industry: '',
      designation: '',
      location: '',
      responsibilities: '',
      doj: '',
      orgDesc: '',
      completePostalAddress: '',
      orgNameOther: '',
      industryOther: '',
      designationOther: '',
    }
    if (data && data.professionalDetails && data.professionalDetails.length > 0) {
      // console.log("org", data.professionalDetails[0].industryOther);

      const organisation = data.professionalDetails[0]
      const isDesiAvailable = _.findIndex(this.designationsMeta, { name: organisation.designation }) !== -1
      org = {
        isGovtOrg: organisation.organisationType,
        orgName: organisation.name,
        orgNameOther: organisation.nameOther,
        industry: organisation.industry,
        industryOther: organisation.industryOther,
        // tslint:disable-next-line
        designation: isDesiAvailable ? organisation.designation : 'Other',
        designationOther: isDesiAvailable ? '' : organisation.designation || organisation.designationOther,
        location: organisation.location,
        responsibilities: organisation.responsibilities,
        doj: this.getDateFromText(organisation.doj),
        orgDesc: organisation.description,
        completePostalAddress: organisation.completePostalAddress,
      }
      if (organisation.organisationType === 'Government') {
        org.isGovtOrg = true
      } else {
        org.isGovtOrg = false
      }
    }

    return org
  }

  private populateAcademics(data: any) {
    const academics: NsUserProfileDetails.IAcademics = {
      X_STANDARD: {
        schoolName10: '',
        yop10: '',
      },
      XII_STANDARD: {
        schoolName12: '',
        yop12: '',
      },
      degree: [],
      postDegree: [],
    }
    if (data.academics && Array.isArray(data.academics)) {
      data.academics.map((item: any) => {
        switch (item.type) {
          case 'X_STANDARD': academics.X_STANDARD.schoolName10 = item.nameOfInstitute
            academics.X_STANDARD.yop10 = item.yearOfPassing
            break
          case 'XII_STANDARD': academics.XII_STANDARD.schoolName12 = item.nameOfInstitute
            academics.XII_STANDARD.yop12 = item.yearOfPassing
            break
          case 'GRADUATE': academics.degree.push({
            degree: item.nameOfQualification,
            instituteName: item.nameOfInstitute,
            yop: item.yearOfPassing,
          })
            break
          case 'POSTGRADUATE': academics.postDegree.push({
            degree: item.nameOfQualification,
            instituteName: item.nameOfInstitute,
            yop: item.yearOfPassing,
          })
            break
        }
      })
    }
    return academics
  }

  private populateChips(data: any) {
    if (data.personalDetails.knownLanguages && data.personalDetails.knownLanguages.length) {
      data.personalDetails.knownLanguages.map((lang: ILanguages) => {
        if (lang) {
          this.selectedKnowLangs.push(lang)
        }
      })
    }
    if (data.interests && data.interests.professional && data.interests.professional.length) {
      data.interests.professional.map((interest: IChipItems) => {
        if (interest) {
          this.personalInterests.push(interest)
        }
      })
    }
    if (data.interests && data.interests.hobbies && data.interests.hobbies.length) {
      data.interests.hobbies.map((interest: IChipItems) => {
        if (interest) {
          this.selectedHobbies.push(interest)
        }
      })
    }
  }

  private filterPrimaryEmailType(data: any) {
    if (data.personalDetails.officialEmail) {
      this.isOfficialEmail = true
    } else {
      this.isOfficialEmail = false
    }
    // this.cd.detectChanges()
    return this.ePrimaryEmailType.OFFICIAL
    // this.assignPrimaryEmailTypeCheckBox(this.ePrimaryEmailType.PERSONAL)
    // return this.ePrimaryEmailType.PERSONAL
  }

  private constructFormFromRegistry(data: any, academics: NsUserProfileDetails.IAcademics, organisation: any) {
    /* tslint:disable */
    this.createUserForm.patchValue({
      firstname: data.personalDetails.firstname,
      middlename: data.personalDetails.middlename,
      surname: data.personalDetails.surname,
      photo: data.photo,
      dob: this.getDateFromText(data.personalDetails.dob),
      nationality: data.personalDetails.nationality,
      domicileMedium: data.personalDetails.domicileMedium,
      gender: data.personalDetails.gender,
      maritalStatus: data.personalDetails.maritalStatus,
      category: data.personalDetails.category,
      knownLanguages: data.personalDetails.knownLanguages,
      countryCode: data.personalDetails.countryCode,
      mobile: data.personalDetails.mobile,
      telephone: this.checkvalue(data.personalDetails.telephone),
      primaryEmail: data.personalDetails.primaryEmail || '',
      secondaryEmail: data.personalDetails.personalEmail,
      primaryEmailType: this.filterPrimaryEmailType(data),
      residenceAddress: data.personalDetails.postalAddress,
      pincode: data.personalDetails.pincode,
      schoolName10: academics.X_STANDARD.schoolName10,
      yop10: academics.X_STANDARD.yop10,
      schoolName12: academics.XII_STANDARD.schoolName12,
      yop12: academics.XII_STANDARD.yop12,
      isGovtOrg: organisation.isGovtOrg,
      // orgName: organisation.orgName,
      industry: organisation.industry,
      designation: organisation.designation || _.get(data, 'professionalDetails.designation'),
      location: organisation.location,
      doj: organisation.doj,
      orgDesc: organisation.orgDesc,
      orgNameOther: organisation.orgNameOther,
      industryOther: organisation.industryOther,
      designationOther: organisation.designationOther,
      orgName: _.get(data, 'employmentDetails.departmentName') || '',
      service: _.get(data, 'employmentDetails.service') || '',
      cadre: _.get(data, 'employmentDetails.cadre') || '',
      allotmentYear: this.checkvalue(_.get(data, 'employmentDetails.allotmentYearOfService') || ''),
      otherDetailsDoj: this.getDateFromText(_.get(data, 'employmentDetails.dojOfService') || ''),
      payType: _.get(data, 'employmentDetails.payType') || '',
      civilListNo: _.get(data, 'employmentDetails.civilListNo') || '',
      employeeCode: this.checkvalue(_.get(data, 'employmentDetails.employeeCode') || ''),
      otherDetailsOfficeAddress: this.checkvalue(_.get(data, 'employmentDetails.officialPostalAddress') || ''),
      otherDetailsOfficePinCode: this.checkvalue(_.get(data, 'employmentDetails.pinCode') || ''),
      skillAquiredDesc: _.get(data, 'skills.additionalSkills') || '',
      certificationDesc: _.get(data, 'skills.certificateDetails') || '',
    },
      {
        emitEvent: true,
      })
    /* tslint:enable */
    this.cd.detectChanges()
    this.cd.markForCheck()
    this.setDropDownOther(organisation)
    this.setProfilePhotoValue(data)
  }

  checkvalue(value: any) {
    if (value && value === 'undefined') {
      // tslint:disable-next-line:no-parameter-reassignment
      value = ''
    } else {
      return value
    }
  }

  setProfilePhotoValue(data: any) {
    this.photoUrl = data.photo || undefined
  }

  setDropDownOther(organisation?: any) {
    if (organisation.designation === 'Other') {
      this.showDesignationOther = true
    }
    if (organisation.orgName === 'Other') {
      this.showOrgnameOther = true
    }

    if (organisation.industry === 'Other') {
      this.showIndustryOther = true
    }
  }

  private setDegreeValuesArray(academics: any) {
    this.degrees = this.createUserForm.get('degrees') as FormArray
    this.degrees.removeAt(0)
    academics.degree.map((degree: any) => { this.addDegreeValues(degree as FormArray) })
  }

  private setPostDegreeValuesArray(academics: any) {
    this.postDegrees = this.createUserForm.get('postDegrees') as FormArray
    this.postDegrees.removeAt(0)
    academics.postDegree.map((degree: any) => { this.addPostDegreeValues(degree as FormArray) })
  }

  // private constructReq(form: any) {
  //   const arrCompetencies = this.configSvc.unMappedUser.profileDetails ? this.configSvc.unMappedUser.profileDetails.competencies : []
  //   const userid = this.userProfileData.userId || this.userProfileData.id
  //   const profileReq = {
  //     id: userid,
  //     userId: userid,
  //     photo: form.value.photo,
  //     personalDetails: {
  //       firstname: form.value.firstname,
  //       middlename: form.value.middlename,
  //       surname: form.value.surname,
  //       dob: form.value.dob,
  //       nationality: form.value.nationality,
  //       domicileMedium: form.value.domicileMedium,
  //       gender: form.value.gender,
  //       maritalStatus: form.value.maritalStatus,
  //       category: form.value.category,
  //       knownLanguages: form.value.knownLanguages,
  //       countryCode: form.value.countryCode,
  //       mobile: form.value.mobile,
  //       telephone: `${form.value.telephone}` || '',
  //       primaryEmail: form.value.primaryEmail,
  //       officialEmail: '',
  //       personalEmail: '',
  //       postalAddress: form.value.residenceAddress,
  //       pincode: form.value.pincode,
  //     },
  //     academics: this.getAcademics(form),
  //     competencies: arrCompetencies,
  //     employmentDetails: {
  //       service: form.value.service,
  //       cadre: form.value.cadre,
  //       allotmentYearOfService: form.value.allotmentYear,
  //       dojOfService: form.value.otherDetailsDoj,
  //       payType: form.value.payType,
  //       civilListNo: form.value.civilListNo,
  //       employeeCode: form.value.employeeCode,
  //       officialPostalAddress: form.value.otherDetailsOfficeAddress,
  //       pinCode: form.value.otherDetailsOfficePinCode,
  //       departmentName: form.value.orgName || form.value.orgNameOther || '',
  //     },
  //     professionalDetails: [
  //       ...this.getOrganisationsHistory(form),
  //     ],
  //     skills: {
  //       additionalSkills: form.value.skillAquiredDesc,
  //       certificateDetails: form.value.certificationDesc,
  //     },
  //     interests: {
  //       professional: form.value.interests,
  //       hobbies: form.value.hobbies,
  //     },
  //   }
  //   if (form.value.primaryEmailType === this.ePrimaryEmailType.OFFICIAL) {
  //     profileReq.personalDetails.officialEmail = form.value.primaryEmail
  //   } else {
  //     profileReq.personalDetails.officialEmail = ''
  //   }
  //   profileReq.personalDetails.personalEmail = form.value.secondaryEmail

  //   let approvalData
  //   _.forOwn(this.approvalConfig, (v, k) => {
  //     if (!v.approvalRequired) {
  //       _.set(profileReq, k, this.getDataforK(k, form))
  //     } else {
  //       _.set(profileReq, k, this.getDataforKRemove(k, v.approvalFiels, form))
  //       approvalData = this.getDataforKAdd(k, v.approvalFiels, form)
  //     }
  //   })
  //   return { profileReq, approvalData }
  // }

  // private getDataforK(k: string, form: any) {
  //   switch (k) {
  //     case 'personalDetails':
  //       let officeEmail = ''
  //       let personalEmail = ''
  //       if (form.value.primaryEmailType === this.ePrimaryEmailType.OFFICIAL) {
  //         officeEmail = form.value.primaryEmail
  //       } else {
  //         officeEmail = ''
  //       }
  //       personalEmail = form.value.secondaryEmail
  //       return {
  //         personalEmail,
  //         firstname: form.value.firstname,
  //         middlename: form.value.middlename,
  //         surname: form.value.surname,
  //         dob: form.value.dob,
  //         nationality: form.value.nationality,
  //         domicileMedium: form.value.domicileMedium,
  //         gender: form.value.gender,
  //         maritalStatus: form.value.maritalStatus,
  //         category: form.value.category,
  //         knownLanguages: form.value.knownLanguages,
  //         countryCode: form.value.countryCode,
  //         mobile: form.value.mobile,
  //         telephone: `${form.value.telephone}` || '',
  //         primaryEmail: form.value.primaryEmail,
  //         officialEmail: officeEmail,
  //         postalAddress: form.value.residenceAddress,
  //         pincode: form.value.pincode,
  //         osid: _.get(this.userProfileData, 'personalDetails.osid') || undefined,
  //       }
  //     case 'academics':
  //       return this.getAcademics(form)
  //     case 'competencies':
  //       return this.configSvc.unMappedUser.profileDetails.competencies
  //     case 'employmentDetails':
  //       return {
  //         service: form.value.service,
  //         cadre: form.value.cadre,
  //         allotmentYearOfService: form.value.allotmentYear,
  //         dojOfService: form.value.otherDetailsDoj || undefined,
  //         payType: form.value.payType,
  //         civilListNo: form.value.civilListNo,
  //         employeeCode: form.value.employeeCode,
  //         officialPostalAddress: form.value.otherDetailsOfficeAddress,
  //         pinCode: form.value.otherDetailsOfficePinCode,
  //         departmentName: form.value.orgName || form.value.orgNameOther || '',
  //         osid: _.get(this.userProfileData, 'employmentDetails.osid') || undefined,
  //       }
  //     case 'professionalDetails':
  //       return [
  //         ...this.getOrganisationsHistory(form),
  //       ]
  //     case 'skills':
  //       return {
  //         additionalSkills: form.value.skillAquiredDesc,
  //         certificateDetails: form.value.certificationDesc,
  //       }
  //     case 'interests':
  //       return {
  //         professional: form.value.interests,
  //         hobbies: form.value.hobbies,
  //       }
  //     default:
  //       return undefined
  //   }
  // }
  // private getDataforKRemove(k: string, fields: string[], form: any) {
  //   const datak = this.getDataforK(k, form)
  //   _.each(datak, (dk, idx) => {
  //     for (let i = 0; i <= fields.length && dk; i += 1) {
  //       const oldVal = _.get(this.userProfileData, `${k}[${idx}].${fields[i]}`)
  //       const newVal = _.get(dk, `${fields[i]}`)
  //       if (oldVal !== newVal) {
  //         _.set(dk, fields[i], oldVal)
  //       }
  //     }
  //   })
  //   return datak
  // }
  // private getDataforKAdd(k: string, fields: string[], form: any) {
  //   const datak = this.getDataforK(k, form)
  //   const lst: any = []
  //   _.each(datak, (dk, idx) => {
  //     for (let i = 0; i <= fields.length && dk; i += 1) {
  //       const oldVal = _.get(this.userProfileData, `${k}[${idx}].${fields[i]}`)
  //       const newVal = _.get(dk, `${fields[i]}`)
  //       if ((oldVal !== newVal) && dk && _.get(dk, fields[i]) && typeof (_.get(dk, fields[i])) !== 'object') {
  //         lst.push({
  //           fieldKey: k,
  //           fromValue: { [fields[i]]: oldVal || '' },
  //           toValue: { [fields[i]]: newVal || '' },
  //           osid: _.get(this.userProfileData, `${k}[${idx}].osid`),
  //         })
  //       }
  //     }
  //   })
  //   return lst
  // }

  // private getOrganisationsHistory(form: any) {
  //   const organisations: any = []
  //   const org = {
  //     organisationType: '',
  //     name: form.value.orgName,
  //     nameOther: form.value.orgNameOther,
  //     industry: form.value.industry,
  //     industryOther: form.value.industryOther,
  //     designation: form.value.designation,
  //     designationOther: form.value.designationOther,
  //     location: form.value.location,
  //     responsibilities: '',
  //     doj: form.value.doj,
  //     description: form.value.orgDesc,
  //     completePostalAddress: '',
  //     additionalAttributes: {},
  //     osid: _.get(this.userProfileData, 'professionalDetails[0].osid') || undefined,
  //   }
  //   if (form.value.isGovtOrg) {
  //     org.organisationType = 'Government'
  //   } else {
  //     org.organisationType = 'Non-Government'
  //   }
  //   organisations.push(org)
  //   return organisations
  // }

  private getAcademics(form: any) {
    const academics = []
    academics.push(this.getClass10(form))
    academics.push(this.getClass12(form))
    academics.push(...this.getDegree(form, 'GRADUATE'))
    academics.push(...this.getPostDegree(form, 'POSTGRADUATE'))
    return academics
  }

  getClass10(form: any): IProfileAcademics {
    return ({
      nameOfQualification: '',
      type: 'X_STANDARD',
      nameOfInstitute: form.value.schoolName10,
      yearOfPassing: `${form.value.yop10}`,
    })
  }

  getClass12(form: any): IProfileAcademics {
    return ({
      nameOfQualification: '',
      type: 'XII_STANDARD',
      nameOfInstitute: form.value.schoolName12,
      yearOfPassing: `${form.value.yop12}`,
    })
  }

  getDegree(form: any, degreeType: string): IProfileAcademics[] {
    const formatedDegrees: IProfileAcademics[] = []
    form.value.degrees.map((degree: any) => {
      formatedDegrees.push({
        nameOfQualification: degree.degree,
        type: degreeType,
        nameOfInstitute: degree.instituteName,
        yearOfPassing: `${degree.yop}`,
      })
    })
    return formatedDegrees
  }

  getPostDegree(form: any, degreeType: string): IProfileAcademics[] {
    const formatedDegrees: IProfileAcademics[] = []
    form.value.postDegrees.map((degree: any) => {
      formatedDegrees.push({
        nameOfQualification: degree.degree,
        type: degreeType,
        nameOfInstitute: degree.instituteName,
        yearOfPassing: `${degree.yop}`,
      })
    })
    return formatedDegrees
  }

  getEditedValues(form: any) {

    const personalDetail: any = {}
    const personalDetailsFields = ['firstname', 'middlename', 'surname',
      'dob', 'nationality', 'domicileMedium', 'gender', 'maritalStatus',
      'category', 'knownLanguages', 'countryCode', 'mobile', 'telephone',
      'primaryEmail', 'officialEmail', 'personalEmail', 'postalAddress',
      'pincode', 'secondaryEmail', 'residenceAddress', 'primaryEmailType']
    const skillsFields = ['skillAquiredDesc', 'certificationDesc']
    const skills: any = {}
    const interestsFields = ['interests', 'hobbies']
    const interests: any = {}
    const employmentDetails: any = {}
    const employmentDetailsFields = ['service', 'cadre', 'allotmentYear',
      'otherDetailsDoj', 'payType', 'civilListNo', 'employeeCode',
      'otherDetailsOfficeAddress', 'otherDetailsOfficePinCode', 'orgName', 'orgNameOther',
    ]
    const professionalDetailsFields = ['isGovtOrg', 'industry', 'designation', 'location',
      'doj', 'orgDesc', 'orgNameOther', 'industryOther', 'designationOther', 'locationOther', 'orgName']
    const professionalDetails: any = []
    const organisations: any = {}
    // let academics = {}
    // let academicsFields = ['schoolName10','yearOfPassing', 'schoolName',
    //   'yearOfPassing12', 'instituteName','yOP', 'institute', 'yOP1' ]
    // let ProfessionalDetails = ['govtOrg']

    Object.keys(this.createUserForm.controls).forEach(name => {
      const currentControl = this.createUserForm.controls[name]
      // console.log(name, form.value.primaryEmailType)
      if (form.value.primaryEmailType === this.ePrimaryEmailType.OFFICIAL) {
        personalDetail['officialEmail'] = form.value.primaryEmail
      } else {
        personalDetail['officialEmail'] = ''
      }
      if (currentControl.dirty) {
        personalDetailsFields.forEach(item => {

          if (item === name) {
            switch (name) {
              case 'knownLanguages': return personalDetail['knownLanguages'] = form.value.knownLanguages
              case 'dob': return personalDetail['dob'] = form.value.dob
              case 'secondaryEmail': return personalDetail['personalEmail'] = form.value.secondaryEmail
              case 'residenceAddress': return personalDetail['postalAddress'] = form.value.residenceAddress
              case 'telephone': return personalDetail['telephone'] = `${form.value.telephone}` || ''

            }

            personalDetail[name] = currentControl.value

          }
        })
        skillsFields.forEach(item => {
          if (item === name) {
            if (name === 'skillAquiredDesc') { skills['additionalSkills'] = currentControl.value }
            if (name === 'certificationDesc') { skills['certificateDetails'] = currentControl.value }
          }
        })
        interestsFields.forEach(item => {
          if (item === name) {
            if (name === 'interests') { interests['professional'] = form.value.interests }
            if (name === 'hobbies') { interests['hobbies'] = form.value.hobbies }

          }
        })
        employmentDetailsFields.forEach(item => {
          if (item === name) {
            switch (name) {
              case 'allotmentYear': return employmentDetails['allotmentYearOfService'] = form.value.allotmentYear
              case 'civilListNo': return employmentDetails['civilListNo'] = form.value.civilListNo
              case 'employeeCode': return employmentDetails['employeeCode'] = form.value.employeeCode
              case 'otherDetailsDoj': return employmentDetails['dojOfService'] = form.value.otherDetailsDoj
              case 'otherDetailsOfficeAddress': return employmentDetails['officialPostalAddress'] = currentControl.value
              case 'otherDetailsOfficePinCode': return employmentDetails['pinCode'] = form.value.otherDetailsOfficePinCode
              case 'orgName' || 'orgNameOther': return employmentDetails['departmentName'] = currentControl.value || ''
              default: return employmentDetails[name] = currentControl.value
            }

          }
        })
        professionalDetailsFields.forEach(item => {

          if (item === name) {
            // console.log(name)
            switch (name) {
              case 'orgName': return organisations['name'] = form.value.orgName
              // tslint:disable-next-line
              case 'orgNameOther': return organisations['nameOther'] = form.value.orgNameOther
              // tslint:disable-next-line
              case 'designation': return organisations['designation'] = form.value.designation === 'Other' ? form.value.designationOther : form.value.designation
              case 'doj': return organisations['doj'] = form.value.doj
              case 'orgDesc': return organisations['description'] = form.value.orgDesc
              case 'isGovtOrg': {
                if (form.value.isGovtOrg) {
                  return organisations['organisationType'] = 'Government'
                }
                return organisations['organisationType'] = 'Non-Government'
              }
              default: return organisations[name] = currentControl.value
            }
          }

        })
        // academicsFields.forEach((item)=>{
        //   if(item === name ){
        //     academics = this.getAcademics(form);
        //   }
        // })

        // let obj:any = { }
        // obj[name] = currentControl.value
        // this.changedProperties.push(name);
        // this.changedProperties = Object.assign({name: currentControl.value},   )
        // this object will have dirty field key and value
        // this.changedProperties.push(name)
      }

    })

    if (Object.keys(organisations).length > 0) { professionalDetails.push(organisations) }
    // console.log(organisations, professionalDetails);

    this.changedProperties = {
      profileDetails: {
        ...(Object.keys(personalDetail).length > 0) && { personalDetails: personalDetail },
        ...(Object.keys(skills).length > 0) && { skills },
        ...(Object.keys(interests).length > 0) && { interests },
        ...(Object.keys(employmentDetails).length > 0) && { employmentDetails },
        ...(Object.keys(professionalDetails).length > 0) && { professionalDetails },

        academics: this.getAcademics(form),
      },
    }

  }

  async onSubmit(form: any) {

    // DO some customization on the input data
    form.value.knownLanguages = this.selectedKnowLangs
    form.value.interests = this.personalInterests
    form.value.hobbies = this.selectedHobbies
    form.value.dob = changeformat(new Date(`${form.value.dob}`))
    form.value.allotmentYear = `${form.value.allotmentYear}`
    form.value.civilListNo = `${form.value.civilListNo}`
    form.value.employeeCode = `${form.value.employeeCode}`
    form.value.otherDetailsOfficePinCode = `${form.value.otherDetailsOfficePinCode}`
    if (form.value.otherDetailsDoj) {
      form.value.otherDetailsDoj = changeformat(new Date(`${form.value.otherDetailsDoj}`))
    }
    if (form.value.doj) {
      form.value.doj = changeformat(new Date(`${form.value.doj}`))
    }

    this.uploadSaveData = true
    this.getEditedValues(form)
    // Construct the request structure for open saber
    // const profileRequest = this.constructReq(form)
    // let appdata = [] as any
    // appdata = profileRequest.approvalData !== undefined ? profileRequest.approvalData : []
    // const reqUpdate = {
    //   request: {
    //     userId: this.configSvc.unMappedUser.id,
    //     profileDetails: profileRequest.profileReq,
    //   },
    // }

    const reqUpdates = {
      request: {
        userId: this.configSvc.unMappedUser.id,
        ...this.changedProperties,
      },
    }

    // console.log( reqUpdate)
    this.userProfileSvc.editProfileDetails(reqUpdates).subscribe(res => {

      if (res.params.status === 'success') {
        if ('professionalDetails' in reqUpdates.request.profileDetails) {
          if ('personalDetails' in reqUpdates.request.profileDetails ||
            'employmentDetails' in reqUpdates.request.profileDetails ||
            'academics' in reqUpdates.request.profileDetails ||
            'interests' in reqUpdates.request.profileDetails ||
            'skills' in reqUpdates.request.profileDetails) {
            if (res.result.personalDetails.status === 'success' && res.result.transitionDetails.status === 'success') {
              this.openSnackbar(this.toastSuccess.nativeElement.value)
              this.router.navigate(['/app/person-profile', (this.userProfileData.userId || this.userProfileData.id)])
            }
          } else {
            if (res.result.transitionDetails.status === 'success') {
              this.openSnackbar(this.toastSuccess.nativeElement.value)
              this.router.navigate(['/app/person-profile', (this.userProfileData.userId || this.userProfileData.id)])
            }

          }
        } else {
          if ('personalDetails' in reqUpdates.request.profileDetails ||
            'employmentDetails' in reqUpdates.request.profileDetails ||
            'interests' in reqUpdates.request.profileDetails ||
            'academics' in reqUpdates.request.profileDetails ||
            'skills' in reqUpdates.request.profileDetails) {
            if (res.result.personalDetails.status === 'success') {
              this.openSnackbar(this.toastSuccess.nativeElement.value)
              this.router.navigate(['/app/person-profile', (this.userProfileData.userId || this.userProfileData.id)])
            }
          } else {
            this.openSnackbar(this.toastError.nativeElement.value, this.userProfileData.id)
          }
        }

      } else {
        this.openSnackbar(this.toastError.nativeElement.value)
      }
    }

    )
    // this.userProfileSvc.updateProfileDetails(reqUpdate).subscribe(
    //   () => {
    //     if (appdata !== undefined && appdata.length > 0) {
    //       if (this.configSvc.userProfile) {
    //         this.userProfileSvc.getUserdetailsFromRegistry(this.configSvc.unMappedUser.id).subscribe(
    //           (data: any) => {
    //             const dat = data.profileDetails
    //             if (dat) {
    //               const academics = this.populateAcademics(dat.academics)
    //               this.setDegreeValuesArray(academics)
    //               this.setPostDegreeValuesArray(academics)
    //               // const organisations = this.populateOrganisationDetails(data[0])
    //               // this.constructFormFromRegistry(data[0], academics, organisations)
    //               this.populateChips(dat)
    //               this.userProfileData = dat
    //               let deptNameValue = ''
    //               if (this.userProfileData && this.userProfileData.professionalDetails
    //                 && this.userProfileData.professionalDetails.length > 0) {
    //                 deptNameValue = form.value.orgName || form.value.orgNameOther || ''
    //               }
    //               const profDetails = {
    //                 state: 'INITIATE',
    //                 action: 'INITIATE',
    //                 userId: this.userProfileData.userId,
    //                 applicationId: this.userProfileData.userId,
    //                 actorUserId: this.userProfileData.userId,
    //                 serviceName: 'profile',
    //                 comment: '',
    //                 wfId: '',
    //                 deptName: deptNameValue,
    //                 updateFieldValues: profileRequest.approvalData,
    //               }
    //               if (deptNameValue && (profDetails.updateFieldValues || []).length > 0) {
    //                 this.userProfileSvc.approveRequest(profDetails).subscribe(() => {
    //                   form.reset()
    //                   this.uploadSaveData = false
    //                   this.configSvc.profileDetailsStatus = true
    //                   this.openSnackbar(this.toastSuccess.nativeElement.value)
    //                   if (!this.isForcedUpdate && this.userProfileData) {
    //                     this.router.navigate(['/app/person-profile', (this.userProfileData.userId || this.userProfileData.id)])
    //                   } else {
    //                     setTimeout(() => {
    //                       // do nothing
    //                       // tslint:disable-next-line
    //                     }, 1000)
    //                     this.router.navigate(['page', 'home'])
    //                   }
    //                 }
    //                   ,
    //                   // tslint:disable-next-line:align
    //                   () => {
    //                     this.openSnackbar(this.toastError.nativeElement.value)
    //                     this.uploadSaveData = false
    //                   })
    //               } else {
    //                 this.uploadSaveData = false
    //                 this.configSvc.profileDetailsStatus = true
    //                 this.openSnackbar(this.toastSuccess.nativeElement.value)
    //                 if (!this.isForcedUpdate && this.userProfileData) {
    //                   // const organisations = this.populateOrganisationDetails(data[0])
    //                   // this.constructFormFromRegistry(data[0], academics, organisations)
    //                   this.router.navigate(['/app/person-profile', (this.userProfileData.userId || this.userProfileData.id)])
    //                 } else {
    //                   setTimeout(() => {
    //                     // do nothing
    //                     // tslint:disable-next-line
    //                   }, 1000)
    //                   this.router.navigate(['page', 'home'])
    //                 }
    //               }
    //             } else {
    //               form.reset()
    //               this.uploadSaveData = false
    //               this.configSvc.profileDetailsStatus = true
    //               this.openSnackbar(this.toastSuccess.nativeElement.value)
    //               if (!this.isForcedUpdate && this.userProfileData) {
    //                 this.router.navigate(['/app/person-profile', (this.userProfileData.userId || this.userProfileData.id)])
    //               } else {
    //                 setTimeout(() => {
    //                   // do nothing
    //                   // tslint:disable-next-line
    //                 }, 1000)
    //                 this.router.navigate(['page', 'home'])
    //               }
    //             }
    //             // this.handleFormData(data[0])
    //           },
    //           (_err: any) => {
    //             if (_err) {
    //               window.location.reload()
    //             }
    //           })
    //       }
    //     } else {
    //       form.reset()
    //       this.uploadSaveData = false
    //       this.configSvc.profileDetailsStatus = true
    //       this.openSnackbar(this.toastSuccess.nativeElement.value)
    //       if (!this.isForcedUpdate && this.userProfileData) {
    //         this.router.navigate(['/app/person-profile', (this.userProfileData.userId || this.userProfileData.id)])
    //       } else {
    //         setTimeout(() => {
    //           // do nothing
    //           // tslint:disable-next-line
    //         }, 1000)
    //         this.router.navigate(['page', 'home'])
    //       }
    //     }
    //   }
    //   ,
    //   () => {
    //     this.openSnackbar(this.toastError.nativeElement.value)
    //     this.uploadSaveData = false
    //   })
  }

  private openSnackbar(primaryMsg: string, duration: number = 5000) {
    this.snackBar.open(primaryMsg, 'X', {
      duration,
    })
  }

  formNext() {
    if (this.selectedIndex === 3) {
      this.selectedIndex = 0
    } else {
      this.selectedIndex = this.selectedIndex + 1
    }
  }
  public navigateBack() {
    this.router.navigate(['page', 'home'])
  }

  public officialEmailCheck() {
    this.isOfficialEmail = !this.isOfficialEmail
    this.assignPrimaryEmailType(this.isOfficialEmail)
  }

  private assignPrimaryEmailType(isOfficialEmail: boolean) {
    if (isOfficialEmail) {
      this.createUserForm.patchValue({
        primaryEmailType: this.ePrimaryEmailType.OFFICIAL,
      })
    } else {
      this.createUserForm.patchValue({
        primaryEmailType: this.ePrimaryEmailType.PERSONAL,
      })
    }
  }

  private assignPrimaryEmailTypeCheckBox(primaryEmailType: any) {
    if (primaryEmailType === this.ePrimaryEmailType.OFFICIAL) {
      this.isOfficialEmail = true
    } else {
      this.isOfficialEmail = false
    }
    // this.assignPrimaryEmailType(this.isOfficialEmail)
  }

  private getDateFromText(dateString: string): any {
    if (dateString) {
      const splitValues: string[] = dateString.split('-')
      const [dd, mm, yyyy] = splitValues
      const dateToBeConverted = `${yyyy}-${mm}-${dd}`
      return new Date(dateToBeConverted)
    }
    return ''
  }

  otherDropDownChange(value: any, field: string) {
    if (field === 'orgname' && value !== 'Other') {
      this.showOrgnameOther = false
      this.createUserForm.controls['orgNameOther'].setValue('')
    }
    if (field === 'industry' && value !== 'Other') {
      this.showIndustryOther = false
      this.createUserForm.controls['industryOther'].setValue('')
    }
    if (field === 'designation' && value !== 'Other') {
      this.showDesignationOther = false
      this.createUserForm.controls['designationOther'].setValue('')
    }
  }

  uploadProfileImg(file: File) {
    const formdata = new FormData()
    const fileName = file.name.replace(/[^A-Za-z0-9.]/g, '')
    if (
      !(
        IMAGE_SUPPORT_TYPES.indexOf(
          `.${fileName
            .toLowerCase()
            .split('.')
            .pop()}`,
        ) > -1
      )
    ) {
      this.snackBar.openFromComponent(NotificationComponent, {
        data: {
          type: Notify.INVALID_FORMAT,
        },
        duration: NOTIFICATION_TIME * 1000,
      })
      return
    }

    if (file.size > IMAGE_MAX_SIZE) {
      this.snackBar.openFromComponent(NotificationComponent, {
        data: {
          type: Notify.SIZE_ERROR,
        },
        duration: NOTIFICATION_TIME * 1000,
      })
      return
    }

    const dialogRef = this.dialog.open(ImageCropComponent, {
      width: '70%',
      data: {
        isRoundCrop: true,
        imageFile: file,
        width: 265,
        height: 150,
        isThumbnail: true,
        imageFileName: fileName,
      },
    })

    dialogRef.afterClosed().subscribe({
      next: (result: File) => {
        if (result) {
          formdata.append('content', result, fileName)
          this.loader.changeLoad.next(true)
          const reader = new FileReader()
          reader.readAsDataURL(result)
          reader.onload = _event => {
            this.photoUrl = reader.result
            if (this.createUserForm.get('photo') !== undefined) {
              // tslint:disable-next-line: no-non-null-assertion
              this.createUserForm.get('photo')!.setValue(this.photoUrl)
            }
          }
        }
      },
    })
  }

  public tabClicked(tabEvent: MatTabChangeEvent) {
    const data: WsEvents.ITelemetryTabData = {
      label: `${tabEvent.tab.textLabel}`,
      index: tabEvent.index,
    }
    this.eventSvc.handleTabTelemetry(
      WsEvents.EnumInteractSubTypes.PROFILE_EDIT_TAB,
      data,
    )
  }
}
