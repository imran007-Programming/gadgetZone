import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { MAX_IMAGE_BYTES, imageOnlyFilter } from '../common/upload.js';
import { BannersService } from './banners.service.js';
import { CreateBannerDto, ReorderBannersDto, UpdateBannerDto } from './dto/banner.dto.js';

@ApiTags('banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Homepage banners that are live right now' })
  list() {
    return this.banners.publicList();
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/banners')
@Roles('ADMIN')
export class AdminBannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  @ApiOperation({ summary: 'All banners in display order (admin)' })
  list() {
    return this.banners.list();
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a banner image to Cloudinary (admin)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_BYTES }, fileFilter: imageOnlyFilter }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.banners.uploadImage(file);
  }

  @Post()
  @ApiOperation({ summary: 'Create a banner (admin)' })
  create(@Body() dto: CreateBannerDto) {
    return this.banners.create(dto);
  }

  // Declared before ":id" so "reorder" is not taken as an id
  @Patch('reorder')
  @ApiOperation({ summary: 'Set the carousel order (admin)' })
  reorder(@Body() dto: ReorderBannersDto) {
    return this.banners.reorder(dto.ids);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a banner (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.banners.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a banner and its Cloudinary image (admin)' })
  remove(@Param('id') id: string) {
    return this.banners.remove(id);
  }
}
