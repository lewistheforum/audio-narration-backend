import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiResponseDto } from '../dto/api-response.dto';

interface ApiResponseOptions {
  type?: Type<unknown> | null;
  status: number;
  message: string;
  isArray?: boolean;
}

const createApiResponseSchema = (options: ApiResponseOptions) => {
  const dataSchema = options.type
    ? options.isArray
      ? { type: 'array', items: { $ref: getSchemaPath(options.type) } }
      : { $ref: getSchemaPath(options.type) }
    : { type: 'null', nullable: true };

  return {
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            statusCode: { type: 'number', example: options.status },
            message: { type: 'string', example: options.message },
            data: dataSchema,
          },
        },
      ],
    },
  };
};

export const ApiResponseData = (options: ApiResponseOptions) => {
  const extraModels = options.type
    ? ApiExtraModels(ApiResponseDto, options.type)
    : ApiExtraModels(ApiResponseDto);

  return applyDecorators(
    extraModels,
    ApiResponse({
      status: options.status,
      ...createApiResponseSchema(options),
    }),
  );
};
